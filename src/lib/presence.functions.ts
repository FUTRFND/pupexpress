import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchRoute } from "@/lib/pricing.server";

const coordSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const presenceSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).nullable().optional(),
  isOnline: z.boolean().default(true),
});

/**
 * A driver row counts as "live" only if it was refreshed within this window.
 * Stale rows (driver closed the app / lost signal) are ignored so riders never
 * see ghost drivers.
 */
const PRESENCE_FRESH_SECONDS = 90;
/** Only count drivers within this straight-line radius of the pickup. */
const NEARBY_RADIUS_METERS = 8000;

/**
 * Upsert the calling driver's live location. Scoped to the authenticated user
 * via RLS — a driver can only ever write their own presence row. Called on a
 * short interval while the driver is online.
 */
export const updateDriverPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => presenceSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("driver_presence").upsert(
      {
        driver_id: userId,
        lat: data.lat,
        lng: data.lng,
        heading: data.heading ?? null,
        is_online: data.isOnline,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Mark the calling driver as offline. Keeps the row (for history) but flips the
 * flag so they stop appearing in nearby lookups immediately.
 */
export const goOffline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("driver_presence")
      .update({ is_online: false, updated_at: new Date().toISOString() })
      .eq("driver_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface NearbyDriversDTO {
  /** Number of online drivers within the nearby radius of the pickup. */
  count: number;
  /** Estimated pickup time of the closest driver, in seconds (traffic-aware). */
  etaSeconds: number | null;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Tell a rider how many drivers are nearby and how soon the closest one could
 * reach the pickup. Reads driver locations with the admin client so individual
 * coordinates are NEVER exposed to the rider — only an aggregate count and an
 * ETA are returned.
 */
export const getNearbyDrivers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pickup: coordSchema }).parse(input))
  .handler(async ({ data }): Promise<NearbyDriversDTO> => {
    const freshSince = new Date(
      Date.now() - PRESENCE_FRESH_SECONDS * 1000,
    ).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("driver_presence")
      .select("lat, lng, updated_at")
      .eq("is_online", true)
      .gte("updated_at", freshSince);

    if (error) throw new Error(error.message);

    const pickup = data.pickup;
    const nearby = (rows ?? [])
      .map((r) => ({
        lat: r.lat,
        lng: r.lng,
        distance: haversineMeters(pickup, { lat: r.lat, lng: r.lng }),
      }))
      .filter((r) => r.distance <= NEARBY_RADIUS_METERS)
      .sort((a, b) => a.distance - b.distance);

    if (nearby.length === 0) {
      return { count: 0, etaSeconds: null };
    }

    let etaSeconds: number | null = null;
    try {
      const route = await fetchRoute(
        { lat: nearby[0].lat, lng: nearby[0].lng },
        pickup,
      );
      etaSeconds = route.durationSeconds;
    } catch {
      // Routing failure is non-fatal — still report the count.
      etaSeconds = null;
    }

    return { count: nearby.length, etaSeconds };
  });
