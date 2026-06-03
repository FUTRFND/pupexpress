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

/** Driver identity + vehicle details a rider can verify before the ride. */
export interface DriverInfoDTO {
  name: string | null;
  photoUrl: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehicleColor: string | null;
  licensePlate: string | null;
  vehiclePhotoUrl: string | null;
  /** Average star rating across all completed rides, null when none yet. */
  avgRating: number | null;
  ratingCount: number;
}

export interface RideDetailDTO {
  ride: RideDTO;
  /** The other participant (driver if you're the rider, and vice-versa). */
  counterpartId: string | null;
  counterpartName: string | null;
  /** Whether the signed-in user is the rider or the driver on this ride. */
  viewerRole: "rider" | "driver";
  /** Populated only when the viewer is the rider and a driver is assigned. */
  driverInfo: DriverInfoDTO | null;
}

const DRIVER_DOCS_BUCKET = "driver-documents";
const SIGNED_URL_TTL = 60 * 60; // 1 hour


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

    return {
      ride: r,
      counterpartId,
      counterpartName,
      viewerRole,
      driverInfo,
    };
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

    // Notify the other participant (best-effort).
    const { data: ride } = await supabase
      .from("rides")
      .select("rider_id, driver_id")
      .eq("id", data.rideId)
      .maybeSingle();
    const recipient = ride
      ? ride.rider_id === userId
        ? ride.driver_id
        : ride.rider_id
      : null;
    if (recipient) {
      const { createNotifications } = await import("./notifications.server");
      await createNotifications([
        {
          user_id: recipient,
          title: "New message",
          body: data.body.slice(0, 140),
          type: "message",
          ride_id: data.rideId,
        },
      ]);
    }

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

const locationPushSchema = z.object({
  rideId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional().nullable(),
});

/**
 * Driver shares their current location for an active ride. RLS ensures only the
 * assigned driver (driver_id = auth.uid()) can insert location points, so a
 * rider can never spoof a driver's position.
 */
export const pushDriverLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => locationPushSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("ride_locations").insert({
      ride_id: data.rideId,
      driver_id: userId,
      lat: data.lat,
      lng: data.lng,
      heading: data.heading ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
  /** Messages from the counterpart the viewer hasn't read yet. */
  unreadCount: number;
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
      .select("ride_id, body, created_at, sender_id, read_at")
      .in("ride_id", rideIds)
      .order("created_at", { ascending: false });

    const lastByRide = new Map<string, { body: string; created_at: string }>();
    const unreadByRide = new Map<string, number>();
    for (const m of messages ?? []) {
      if (!lastByRide.has(m.ride_id)) {
        lastByRide.set(m.ride_id, { body: m.body, created_at: m.created_at });
      }
      if (m.sender_id !== userId && !m.read_at) {
        unreadByRide.set(m.ride_id, (unreadByRide.get(m.ride_id) ?? 0) + 1);
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
        unreadCount: unreadByRide.get(r.id) ?? 0,
      };
    });
  });

/**
 * Mark all messages on a ride from the counterpart as read for the signed-in
 * user. Participation is verified through RLS (the user can only read the ride
 * row if they're the rider or driver); the read flag is then written with the
 * admin client because `messages` intentionally has no client UPDATE policy.
 */
export const markRideMessagesRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rideIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    // RLS: only a participant can see this ride row.
    const { data: ride, error } = await supabase
      .from("rides")
      .select("id")
      .eq("id", data.rideId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ride) throw new Error("Ride not found.");

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await supabaseAdmin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("ride_id", data.rideId)
      .neq("sender_id", userId)
      .is("read_at", null);

    return { ok: true };
  });

/**
 * Total number of unread messages addressed to the signed-in user across all of
 * their rides (used for the Messages tab badge). Scoped to the user's rides via
 * the admin client after filtering by participation.
 */
export const getUnreadMessageCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ count: number }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: rides } = await supabaseAdmin
      .from("rides")
      .select("id")
      .or(`rider_id.eq.${userId},driver_id.eq.${userId}`);
    const ids = (rides ?? []).map((r) => r.id);
    if (ids.length === 0) return { count: 0 };

    const { count } = await supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("ride_id", ids)
      .neq("sender_id", userId)
      .is("read_at", null);

    return { count: count ?? 0 };
  });
