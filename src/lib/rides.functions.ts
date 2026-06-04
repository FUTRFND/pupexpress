import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { quoteFare } from "@/lib/pricing.server";

export interface RideDTO {
  id: string;
  status: string;
  payment_status: string;
  transfer_status: string;
  pickup_address: string;
  destination_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  pet_id: string | null;
  rider_id: string;
  driver_id: string | null;
  notes: string | null;
  ride_total: number;
  platform_fee: number;
  driver_earnings: number;
  tip_amount: number;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  paid_at: string | null;
  transferred_at: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  scheduled_for: string | null;
}

export const RIDE_COLUMNS =
  "id, status, payment_status, transfer_status, pickup_address, destination_address, pickup_lat, pickup_lng, destination_lat, destination_lng, pet_id, rider_id, driver_id, notes, ride_total, platform_fee, driver_earnings, tip_amount, created_at, accepted_at, started_at, completed_at, paid_at, transferred_at, cancellation_reason, cancelled_at, cancelled_by, scheduled_for";

const locationSchema = z.object({
  address: z.string().trim().min(1, "Address is required").max(300),
  placeId: z.string().trim().max(300).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const createRideSchema = z.object({
  pickup: locationSchema,
  destination: locationSchema,
  petId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  referralCode: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/)
    .optional()
    .nullable(),
  // ISO timestamp for a future scheduled pickup. Null/omitted = ride now.
  scheduledFor: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable()
    .refine(
      (v) => !v || new Date(v).getTime() > Date.now() + 5 * 60 * 1000,
      "Scheduled time must be at least 5 minutes from now.",
    ),
});

/** Create a ride request for the signed-in rider. */
export const createRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createRideSchema.parse(input))
  .handler(async ({ data, context }): Promise<RideDTO> => {
    const { supabase, userId } = context;

    // Compute the fare server-side from the live driving route so the stored
    // total can't be tampered with by the client. If the route lookup fails
    // (e.g. maps temporarily unavailable) fall back to the base fare model.
    let rideTotal = 0;
    let platformFee = 0;
    let driverEarnings = 0;
    try {
      const quote = await quoteFare(
        { lat: data.pickup.lat, lng: data.pickup.lng },
        { lat: data.destination.lat, lng: data.destination.lng },
      );
      rideTotal = quote.rideTotal;
      platformFee = quote.platformFee;
      driverEarnings = quote.driverEarnings;
    } catch (err) {
      console.error("Fare quote failed; storing zeroed total", err);
    }

    const { data: ride, error } = await supabase
      .from("rides")
      .insert({
        rider_id: userId,
        pickup_address: data.pickup.address,
        pickup_place_id: data.pickup.placeId ?? null,
        pickup_lat: data.pickup.lat,
        pickup_lng: data.pickup.lng,
        destination_address: data.destination.address,
        destination_place_id: data.destination.placeId ?? null,
        destination_lat: data.destination.lat,
        destination_lng: data.destination.lng,
        pet_id: data.petId ?? null,
        notes: data.notes ?? null,
        referral_code: data.referralCode ? data.referralCode.toUpperCase() : null,
        ride_total: rideTotal,
        platform_fee: platformFee,
        driver_earnings: driverEarnings,
        status: "requested",
        payment_status: "unpaid",
        transfer_status: "not_ready",
        scheduled_for: data.scheduledFor ?? null,
      })
      .select(RIDE_COLUMNS)
      .single();

    if (error) throw new Error(error.message);

    const created = ride as RideDTO;
    // Let available drivers know there's a new ride to claim (best-effort).
    const { notifyAvailableDrivers } = await import("./notifications.server");
    await notifyAvailableDrivers(
      {
        title: "New ride request",
        body: `Pickup at ${created.pickup_address}. Tap to view and accept.`,
        type: "ride",
        ride_id: created.id,
      },
      userId,
    );

    return created;
  });

/** List rides the signed-in user requested as a rider, newest first. */
export const listMyRides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RideDTO[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("rides")
      .select(RIDE_COLUMNS)
      .eq("rider_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as RideDTO[];
  });

/** Cancel a ride the signed-in rider owns (only before it is in progress). */
export const cancelMyRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        rideId: z.string().uuid(),
        reason: z.string().trim().max(300).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<RideDTO> => {
    const { supabase, userId } = context;
    const { data: ride, error } = await supabase
      .from("rides")
      .update({
        status: "cancelled",
        cancellation_reason: data.reason?.trim() || null,
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
      })
      .eq("id", data.rideId)
      .eq("rider_id", userId)
      .in("status", ["requested", "accepted", "driver_en_route", "driver_arrived"])
      .select(RIDE_COLUMNS)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ride) throw new Error("This ride can no longer be cancelled.");

    const cancelled = ride as RideDTO;
    // If a driver had already accepted, let them know it's off (best-effort).
    if (cancelled.driver_id) {
      const { createNotifications } = await import("./notifications.server");
      await createNotifications([
        {
          user_id: cancelled.driver_id,
          title: "Ride cancelled by rider",
          body: cancelled.cancellation_reason
            ? `The rider cancelled: "${cancelled.cancellation_reason}"`
            : "The rider cancelled this ride. It's been removed from your trips.",
          type: "ride",
          ride_id: cancelled.id,
        },
      ]);
    }

    return cancelled;
  });

/**
 * Rider confirms the driver has arrived and starts the ride. Scoped by
 * rider_id (RLS-backed) and the driver_arrived state, so only the rider can
 * begin, and only once the driver is at the pickup point.
 */
export const startRideAsRider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rideId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<RideDTO> => {
    const { supabase, userId } = context;
    const { data: ride, error } = await supabase
      .from("rides")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", data.rideId)
      .eq("rider_id", userId)
      .eq("status", "driver_arrived")
      .select(RIDE_COLUMNS)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ride) throw new Error("This ride can't be started right now.");

    const started = ride as RideDTO;
    if (started.driver_id) {
      const { createNotifications } = await import("./notifications.server");
      await createNotifications([
        {
          user_id: started.driver_id,
          title: "Ride started",
          body: "The rider confirmed pickup. The ride is now in progress.",
          type: "ride",
          ride_id: started.id,
        },
      ]);
    }

    return started;
  });
