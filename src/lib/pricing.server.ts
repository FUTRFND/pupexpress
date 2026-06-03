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
 * Fetch the driving route between two coordinates via the connector gateway.
 * Returns distance (meters) and duration (seconds), or throws on failure.
 */
export async function fetchRoute(
  origin: Coord,
  destination: Coord,
): Promise<RouteResult> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured.");
  if (!mapsKey) throw new Error("GOOGLE_MAPS_API_KEY is not configured.");

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

export { getFeeConfig };
