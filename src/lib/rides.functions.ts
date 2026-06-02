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
  notes: string | null;
  created_at: string;
}

const RIDE_COLUMNS =
  "id, status, payment_status, transfer_status, pickup_address, destination_address, pickup_lat, pickup_lng, destination_lat, destination_lng, pet_id, notes, created_at";

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

/** List rides for the signed-in rider, newest first. */
export const listMyRides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RideDTO[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("rides")
      .select(RIDE_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as RideDTO[];
  });
