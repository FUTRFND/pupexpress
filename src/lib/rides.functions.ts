import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  paid_at: string | null;
  transferred_at: string | null;
}

export const RIDE_COLUMNS =
  "id, status, payment_status, transfer_status, pickup_address, destination_address, pickup_lat, pickup_lng, destination_lat, destination_lng, pet_id, rider_id, driver_id, notes, ride_total, platform_fee, driver_earnings, created_at, accepted_at, started_at, completed_at, paid_at, transferred_at";

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
});

/** Create a ride request for the signed-in rider. */
export const createRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createRideSchema.parse(input))
  .handler(async ({ data, context }): Promise<RideDTO> => {
    const { supabase, userId } = context;

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
        status: "requested",
        payment_status: "unpaid",
        transfer_status: "not_ready",
      })
      .select(RIDE_COLUMNS)
      .single();

    if (error) throw new Error(error.message);
    return ride as RideDTO;
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
    z.object({ rideId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<RideDTO> => {
    const { supabase, userId } = context;
    const { data: ride, error } = await supabase
      .from("rides")
      .update({ status: "cancelled" })
      .eq("id", data.rideId)
      .eq("rider_id", userId)
      .in("status", ["requested", "accepted", "driver_en_route"])
      .select(RIDE_COLUMNS)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ride) throw new Error("This ride can no longer be cancelled.");
    return ride as RideDTO;
  });
