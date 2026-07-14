import process from "node:process";

import { computeFees, getFeeConfig, type FeeBreakdown } from "./stripe.server";

/**
 * Server-only fare engine. Turns a route (distance + duration) into a ride
 * total using a fully configurable pricing model, then derives the platform
 * fee / driver split via the existing `computeFees` helper.
 *
 * Pricing is NEVER hardcoded across the app — every knob is an env var with a
 * placeholder default that can be tuned before go-live:
 *
 *   RIDE_BASE_FARE    flag-drop fare added to every ride (currency units)
 *   RIDE_PER_KM       price per kilometer travelled (currency units)
 *   RIDE_PER_MIN      price per minute of estimated drive time (currency units)
 *   RIDE_MIN_FARE     minimum total a ride can cost (currency units)
 *
 * The Routes API call goes through the Lovable connector gateway so the
 * Google Maps key is never exposed and OAuth refresh is handled for us.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
}

export interface FareConfig {
  baseFare: number;
  perKm: number;
  perMin: number;
  minFare: number;
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getFareConfig(): FareConfig {
  return {
    baseFare: numEnv("RIDE_BASE_FARE", 5),
    perKm: numEnv("RIDE_PER_KM", 1.5),
    perMin: numEnv("RIDE_PER_MIN", 0.35),
    minFare: numEnv("RIDE_MIN_FARE", 8),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface Coord {
  lat: number;
  lng: number;
}

/**
 * Straight-line haversine fallback used when the Google Maps connector isn't
 * available. Assumes ~40 km/h average urban drive speed with a 1.3x road
 * detour factor so quotes stay in a sensible range.
 */
function estimateRouteFallback(origin: Coord, destination: Coord): RouteResult {
  const R = 6371000; // meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.lat)) *
      Math.cos(toRad(destination.lat)) *
      Math.sin(dLng / 2) ** 2;
  const straight = 2 * R * Math.asin(Math.sqrt(a));
  const distanceMeters = Math.round(straight * 1.3);
  const durationSeconds = Math.round((distanceMeters / 1000 / 40) * 3600);
  return { distanceMeters, durationSeconds };
}

/**
 * Fetch the driving route between two coordinates via the connector gateway.
 * Returns distance (meters) and duration (seconds), or throws on failure.
 */

export async function fetchRoute(
  origin: Coord,
  destination: Coord,
): Promise<RouteResult> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !mapsKey) {
    // Graceful degrade when the Google Maps connector isn't linked yet:
    // estimate distance/duration from a straight-line haversine so quoting
    // still works instead of crashing the UI with a runtime error.
    return estimateRouteFallback(origin, destination);
  }


  const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify({
      origin: {
        location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
      },
      destination: {
        location: {
          latLng: { latitude: destination.lat, longitude: destination.lng },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Routes API error (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    routes?: { distanceMeters?: number; duration?: string }[];
  };
  const route = data.routes?.[0];
  if (!route || route.distanceMeters == null || route.duration == null) {
    throw new Error("No route found between those locations.");
  }

  // duration arrives as a protobuf duration string like "3343s".
  const durationSeconds = Number(String(route.duration).replace(/s$/, ""));

  return {
    distanceMeters: route.distanceMeters,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
  };
}

export interface FareQuote extends FeeBreakdown {
  distanceMeters: number;
  durationSeconds: number;
}

/** Turn a route into a ride total using the configurable fare model. */
export function computeFareFromRoute(route: RouteResult): FareQuote {
  const cfg = getFareConfig();
  const km = route.distanceMeters / 1000;
  const minutes = route.durationSeconds / 60;

  let total = cfg.baseFare + km * cfg.perKm + minutes * cfg.perMin;
  if (total < cfg.minFare) total = cfg.minFare;
  total = round2(total);

  const fees = computeFees(total);
  return {
    ...fees,
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
  };
}

/** Convenience: fetch the route and compute the fare in one call. */
export async function quoteFare(
  origin: Coord,
  destination: Coord,
): Promise<FareQuote> {
  const route = await fetchRoute(origin, destination);
  return computeFareFromRoute(route);
}

// ---------------------------------------------------------------------------
// Configurable cancellation / no-show fee policy
// ---------------------------------------------------------------------------
// Like every other commercial knob, cancellation fees are NEVER hardcoded —
// each value is an env var with a placeholder default that can be tuned before
// go-live:
//
//   CANCEL_FEE_GRACE_SECONDS  free-cancel window after a driver accepts (seconds)
//   CANCEL_FEE_AMOUNT         rider late-cancellation fee (currency units)
//   NO_SHOW_FEE_AMOUNT        driver-reported rider no-show fee (currency units)
//   CANCEL_FEE_DRIVER_SHARE   fraction of the fee paid to the driver (0..1)

export interface CancellationPolicy {
  graceSeconds: number;
  lateCancelFee: number;
  noShowFee: number;
  driverShare: number;
}

export function getCancellationPolicy(): CancellationPolicy {
  return {
    graceSeconds: numEnv("CANCEL_FEE_GRACE_SECONDS", 120),
    lateCancelFee: numEnv("CANCEL_FEE_AMOUNT", 5),
    noShowFee: numEnv("NO_SHOW_FEE_AMOUNT", 10),
    driverShare: Math.min(Math.max(numEnv("CANCEL_FEE_DRIVER_SHARE", 0.8), 0), 1),
  };
}

export type CancellationReason = "free" | "late_cancel" | "no_show";

export interface CancellationFeeResult {
  /** Total fee charged to the rider. */
  fee: number;
  /** Portion of the fee that is paid out to the driver. */
  driverShare: number;
  /** Portion of the fee the platform keeps. */
  platformShare: number;
  reason: CancellationReason;
}

function splitCancellationFee(
  fee: number,
  driverShareFraction: number,
  reason: CancellationReason,
): CancellationFeeResult {
  const f = round2(fee);
  const driverShare = round2(f * driverShareFraction);
  const platformShare = round2(f - driverShare);
  return { fee: f, driverShare, platformShare, reason };
}

/**
 * Decide what (if any) cancellation fee applies, based on who is cancelling and
 * the ride's current state. Pure + deterministic so it can run on cancel, on
 * no-show reporting, and when quoting the fee to the rider beforehand.
 *
 *   - Rider, ride still `requested` (no driver) → free.
 *   - Rider, within the grace window after a driver accepted → free.
 *   - Rider, after the grace window → late-cancellation fee.
 *   - Driver, rider didn't show after arrival (`driver_arrived`) → no-show fee.
 */
export function computeCancellationFee(params: {
  status: string;
  acceptedAt: string | null;
  cancelledBy: "rider" | "driver";
}): CancellationFeeResult {
  const policy = getCancellationPolicy();
  const free: CancellationFeeResult = {
    fee: 0,
    driverShare: 0,
    platformShare: 0,
    reason: "free",
  };

  if (params.cancelledBy === "driver") {
    if (params.status === "driver_arrived" && policy.noShowFee > 0) {
      return splitCancellationFee(policy.noShowFee, policy.driverShare, "no_show");
    }
    return free;
  }

  // Rider cancellation.
  if (params.status === "requested" || !params.acceptedAt) return free;

  const elapsedSeconds =
    (Date.now() - new Date(params.acceptedAt).getTime()) / 1000;
  if (elapsedSeconds <= policy.graceSeconds) return free;
  if (policy.lateCancelFee <= 0) return free;
  return splitCancellationFee(policy.lateCancelFee, policy.driverShare, "late_cancel");
}

export { getFeeConfig };
