import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RIDE_COLUMNS, type RideDTO } from "./rides.functions";

/**
 * Driver-side ride lifecycle.
 *
 * All writes run through `requireSupabaseAuth`, so they execute as the signed-in
 * user and remain subject to RLS. Concurrency is enforced by conditional
 * updates (status / driver_id predicates in the WHERE clause), which are atomic
 * at the Postgres row level — two drivers cannot claim the same ride, and a
 * driver cannot advance a ride they do not own or that is in the wrong state.
 */

/**
 * Ensure the signed-in user can act as a driver. New accounts default to the
 * "rider" role; switching into driver mode upgrades them to "both" so they
 * keep their rider history while gaining driver visibility (RLS checks the
 * profile role for open ride requests).
 */
export const ensureDriverRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ role: string }> => {
    const { supabase, userId } = context;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (error) throw new Error(error.message);

    if (profile.role === "rider") {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role: "both" })
        .eq("id", userId);
      if (updateError) throw new Error(updateError.message);
      return { role: "both" };
    }

    return { role: profile.role };
  });

/** Open ride requests available for any driver to accept (RLS-gated to drivers). */
export const listAvailableRides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RideDTO[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("rides")
      .select(RIDE_COLUMNS)
      .is("driver_id", null)
      .eq("status", "requested")
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as RideDTO[];
  });

/** Rides assigned to the signed-in driver, newest first. */
export const listMyDriverRides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RideDTO[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("rides")
      .select(RIDE_COLUMNS)
      .eq("driver_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as RideDTO[];
  });

/**
 * Claim an open ride. The conditional WHERE (driver_id IS NULL, status =
 * 'requested') guarantees only ONE driver wins; the second attempt updates
 * zero rows and surfaces a friendly error.
 */
export const acceptRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rideId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<RideDTO> => {
    const { supabase, userId } = context;

    const { data: ride, error } = await supabase
      .from("rides")
      .update({
        driver_id: userId,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", data.rideId)
      .is("driver_id", null)
      .eq("status", "requested")
      .select(RIDE_COLUMNS)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ride) {
      throw new Error("This ride was just taken by another driver.");
    }

    const accepted = ride as RideDTO;
    const { createNotifications } = await import("./notifications.server");
    await createNotifications([
      {
        user_id: accepted.rider_id,
        title: "A driver accepted your ride",
        body: "Your driver is getting ready. Track the ride and chat anytime.",
        type: "ride",
        ride_id: accepted.id,
      },
    ]);

    return accepted;
  });

type RideAction = "en_route" | "arrive" | "complete" | "cancel";

type RideStatus =
  | "requested"
  | "accepted"
  | "driver_en_route"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

interface TransitionRule {
  from: RideStatus[];
  to: RideStatus;
  timestamp?: "started_at" | "completed_at";
}

const TRANSITIONS: Record<RideAction, TransitionRule> = {
  en_route: { from: ["accepted"], to: "driver_en_route" },
  arrive: { from: ["driver_en_route"], to: "driver_arrived" },
  complete: { from: ["in_progress"], to: "completed", timestamp: "completed_at" },
  cancel: { from: ["accepted", "driver_en_route", "driver_arrived"], to: "cancelled" },
};

/**
 * Advance a ride the signed-in driver owns through its lifecycle. The update is
 * scoped by driver_id = self AND the expected current status, so a driver can
 * never start/complete a ride they did not accept, nor skip states.
 */
export const advanceRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        rideId: z.string().uuid(),
        action: z.enum(["en_route", "arrive", "complete", "cancel"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<RideDTO> => {
    const { supabase, userId } = context;
    const rule = TRANSITIONS[data.action as RideAction];

    const patch: {
      status: RideStatus;
      started_at?: string;
      completed_at?: string;
    } = { status: rule.to };
    if (rule.timestamp) patch[rule.timestamp] = new Date().toISOString();

    const { data: ride, error } = await supabase
      .from("rides")
      .update(patch)
      .eq("id", data.rideId)
      .eq("driver_id", userId)
      .in("status", rule.from)
      .select(RIDE_COLUMNS)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ride) {
      throw new Error("That ride is no longer in a state you can update.");
    }

    const updated = ride as RideDTO;
    const messages: Record<RideAction, { title: string; body: string }> = {
      en_route: {
        title: "Your driver is en route",
        body: "Your driver is on the way to the pickup location.",
      },
      start: {
        title: "Your ride has started",
        body: "Your pet is on the way to the destination.",
      },
      complete: {
        title: "Ride completed",
        body: "Hope it went great! Tap to rate your driver.",
      },
      cancel: {
        title: "Ride cancelled",
        body: "Your driver cancelled this ride. You can book again anytime.",
      },
    };
    const note = messages[data.action as RideAction];
    const { createNotifications } = await import("./notifications.server");
    await createNotifications([
      {
        user_id: updated.rider_id,
        title: note.title,
        body: note.body,
        type: "ride",
        ride_id: updated.id,
      },
    ]);

    return updated;
  });
