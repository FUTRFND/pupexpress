import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RIDE_COLUMNS, type RideDTO } from "./rides.functions";

export interface MessageDTO {
  id: string;
  ride_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface RideLocationDTO {
  lat: number;
  lng: number;
  heading: number | null;
  created_at: string;
}

export interface RideDetailDTO {
  ride: RideDTO;
  /** The other participant (driver if you're the rider, and vice-versa). */
  counterpartId: string | null;
  counterpartName: string | null;
  /** Whether the signed-in user is the rider or the driver on this ride. */
  viewerRole: "rider" | "driver";
}

const rideIdSchema = z.object({ rideId: z.string().uuid() });

/**
 * Fetch a single ride the signed-in user participates in (rider or driver),
 * plus the counterpart's display name. RLS guarantees only participants can
 * read the ride row; the counterpart name is resolved with the admin client
 * AFTER participation is confirmed, so no profile data leaks.
 */
export const getRideDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<RideDetailDTO> => {
    const { supabase, userId } = context;

    const { data: ride, error } = await supabase
      .from("rides")
      .select(RIDE_COLUMNS)
      .eq("id", data.rideId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ride) throw new Error("Ride not found.");

    const r = ride as RideDTO;
    const viewerRole: "rider" | "driver" =
      r.rider_id === userId ? "rider" : "driver";
    const counterpartId =
      viewerRole === "rider" ? r.driver_id : r.rider_id;

    let counterpartName: string | null = null;
    if (counterpartId) {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", counterpartId)
        .maybeSingle();
      counterpartName = profile?.full_name ?? null;
    }

    return { ride: r, counterpartId, counterpartName, viewerRole };
  });

/** Load the message history for a ride. RLS scopes this to ride participants. */
export const listRideMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<MessageDTO[]> => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("messages")
      .select("id, ride_id, sender_id, body, created_at")
      .eq("ride_id", data.rideId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return (rows ?? []) as MessageDTO[];
  });

const sendMessageSchema = z.object({
  rideId: z.string().uuid(),
  body: z.string().trim().min(1, "Message can't be empty").max(2000),
});

/**
 * Send a chat message on a ride. RLS enforces that the sender is the signed-in
 * user AND a participant of the ride, so messages can only flow between the
 * rider and their assigned driver.
 */
export const sendRideMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendMessageSchema.parse(input))
  .handler(async ({ data, context }): Promise<MessageDTO> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("messages")
      .insert({
        ride_id: data.rideId,
        sender_id: userId,
        body: data.body,
      })
      .select("id, ride_id, sender_id, body, created_at")
      .single();

    if (error) throw new Error(error.message);
    return row as MessageDTO;
  });

/** Latest known driver location for a ride (null until the driver shares it). */
export const getRideLatestLocation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<RideLocationDTO | null> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("ride_locations")
      .select("lat, lng, heading, created_at")
      .eq("ride_id", data.rideId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return (row as RideLocationDTO) ?? null;
  });

export interface ConversationDTO {
  rideId: string;
  status: string;
  counterpartName: string | null;
  pickupAddress: string;
  destinationAddress: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

/**
 * List the signed-in user's ride conversations (rides that have an assigned
 * driver, so a counterpart exists). Uses the admin client AFTER scoping every
 * query to rides the user participates in, then attaches counterpart names and
 * the latest message preview.
 */
export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversationDTO[]> => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: rides, error } = await supabaseAdmin
      .from("rides")
      .select(
        "id, status, rider_id, driver_id, pickup_address, destination_address, created_at",
      )
      .or(`rider_id.eq.${userId},driver_id.eq.${userId}`)
      .not("driver_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    const rideRows = rides ?? [];
    if (rideRows.length === 0) return [];

    const counterpartIds = Array.from(
      new Set(
        rideRows.map((r) =>
          r.rider_id === userId ? r.driver_id : r.rider_id,
        ),
      ),
    ).filter((id): id is string => Boolean(id));

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", counterpartIds);
    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id, p.full_name as string | null]),
    );

    const rideIds = rideRows.map((r) => r.id);
    const { data: messages } = await supabaseAdmin
      .from("messages")
      .select("ride_id, body, created_at")
      .in("ride_id", rideIds)
      .order("created_at", { ascending: false });

    const lastByRide = new Map<string, { body: string; created_at: string }>();
    for (const m of messages ?? []) {
      if (!lastByRide.has(m.ride_id)) {
        lastByRide.set(m.ride_id, { body: m.body, created_at: m.created_at });
      }
    }

    return rideRows.map((r) => {
      const counterpartId = r.rider_id === userId ? r.driver_id : r.rider_id;
      const last = lastByRide.get(r.id);
      return {
        rideId: r.id,
        status: r.status,
        counterpartName: counterpartId
          ? nameById.get(counterpartId) ?? null
          : null,
        pickupAddress: r.pickup_address,
        destinationAddress: r.destination_address,
        lastMessage: last?.body ?? null,
        lastMessageAt: last?.created_at ?? null,
        createdAt: r.created_at,
      };
    });
  });
