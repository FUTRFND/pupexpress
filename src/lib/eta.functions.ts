import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchRoute } from "@/lib/pricing.server";

export interface RideEtaDTO {
  /** Whether the driver is currently heading to the pickup or the destination. */
  target: "pickup" | "destination";
  /** Estimated remaining drive time in seconds (traffic-aware). */
  durationSeconds: number;
  /** Estimated remaining distance in meters. */
  distanceMeters: number;
}

const rideIdSchema = z.object({ rideId: z.string().uuid() });

/**
 * Compute the live ETA for an active ride using the driver's latest shared
 * location and the Google Routes API (traffic-aware). Before the ride starts
 * the ETA targets the pickup; once in progress it targets the destination.
 *
 * Returns null when there's nothing to estimate yet (no driver location, ride
 * not active, or the target coordinates are missing). RLS scopes the ride read
 * to participants, so only the rider/driver can request an ETA.
 */
export const getRideEta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<RideEtaDTO | null> => {
    const { supabase } = context;

    const { data: ride, error } = await supabase
      .from("rides")
      .select(
        "id, status, pickup_lat, pickup_lng, destination_lat, destination_lng",
      )
      .eq("id", data.rideId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ride) return null;

    // Only estimate while the ride is actively being fulfilled.
    const activeBeforeStart = [
      "accepted",
      "driver_en_route",
      "driver_arrived",
    ];
    const target: "pickup" | "destination" =
      ride.status === "in_progress" ? "destination" : "pickup";
    if (target === "pickup" && !activeBeforeStart.includes(ride.status)) {
      return null;
    }

    const targetCoord =
      target === "destination"
        ? { lat: ride.destination_lat, lng: ride.destination_lng }
        : { lat: ride.pickup_lat, lng: ride.pickup_lng };
    if (targetCoord.lat == null || targetCoord.lng == null) return null;

    // Latest driver location — the origin of the ETA route.
    const { data: loc } = await supabase
      .from("ride_locations")
      .select("lat, lng")
      .eq("ride_id", data.rideId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!loc) return null;

    try {
      const route = await fetchRoute(
        { lat: loc.lat, lng: loc.lng },
        { lat: targetCoord.lat, lng: targetCoord.lng },
      );
      return {
        target,
        durationSeconds: route.durationSeconds,
        distanceMeters: route.distanceMeters,
      };
    } catch {
      // Routing failures are non-fatal — the UI just hides the ETA.
      return null;
    }
  });
