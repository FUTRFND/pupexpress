import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RideLocationDTO } from "@/lib/ride-detail.functions";

/** Display name used to identify the simulated driver in demo conversations. */
export const DEMO_DRIVER_NAME = "Demo Driver";
const DEMO_DRIVER_EMAIL = "demo-driver@pupxpress.local";

/** Fixed San Francisco route used so the demo ride has a real map + car path. */
const DEMO_PICKUP = { lat: 37.7694, lng: -122.4862 }; // near Golden Gate Park
const DEMO_DESTINATION = { lat: 37.7599, lng: -122.4148 }; // Dolores / dog park

/**
 * Resolve the demo driver's user id, creating a real auth user the first time
 * (rides.driver_id -> profiles.id -> auth.users, so a real account is required).
 */
async function ensureDemoDriverId(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server")["supabaseAdmin"],
): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", DEMO_DRIVER_EMAIL)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: DEMO_DRIVER_EMAIL,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: DEMO_DRIVER_NAME },
  });
  if (error || !created.user) {
    throw new Error(error?.message ?? "Couldn't create demo driver.");
  }

  // Mark the profile as a driver (the new-user trigger seeds it as a rider).
  await supabaseAdmin
    .from("profiles")
    .update({ role: "driver", full_name: DEMO_DRIVER_NAME })
    .eq("id", created.user.id);

  return created.user.id;
}

/**
 * Create (or reuse) a demo conversation: a ride where the signed-in user is the
 * rider and a synthetic "Demo Driver" is the counterpart. Lets a single account
 * test the in-app chat end to end.
 */
export const createDemoConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rideId: string }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const demoDriverId = await ensureDemoDriverId(supabaseAdmin);

    // Reuse an existing demo ride for this user if one is already open.
    const { data: existing } = await supabaseAdmin
      .from("rides")
      .select("id")
      .eq("rider_id", userId)
      .eq("driver_id", demoDriverId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return { rideId: existing.id };

    const now = new Date().toISOString();
    const { data: ride, error } = await supabaseAdmin
      .from("rides")
      .insert({
        rider_id: userId,
        driver_id: demoDriverId,
        status: "accepted",
        pickup_address: "123 Bark Avenue (Demo)",
        destination_address: "Sunnyside Dog Park (Demo)",
        pickup_lat: DEMO_PICKUP.lat,
        pickup_lng: DEMO_PICKUP.lng,
        destination_lat: DEMO_DESTINATION.lat,
        destination_lng: DEMO_DESTINATION.lng,
        accepted_at: now,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    // Seed a friendly opener from the demo driver.
    await supabaseAdmin.from("messages").insert({
      ride_id: ride.id,
      sender_id: demoDriverId,
      body: "Hi! I'm your demo driver 🐾 Send a message and I'll appear on the rider side. Use the toggle to reply as the driver too.",
    });

    return { rideId: ride.id };
  });

const demoMessageSchema = z.object({
  rideId: z.string().uuid(),
  body: z.string().trim().min(1, "Message can't be empty").max(2000),
  as: z.enum(["rider", "driver"]),
});

/**
 * Insert a message into a demo ride as either the rider or the driver, so a
 * single account can simulate both sides of the conversation. Verifies the
 * signed-in user participates in the ride before writing (admin client).
 */
export const sendDemoMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => demoMessageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: ride } = await supabaseAdmin
      .from("rides")
      .select("id, rider_id, driver_id")
      .eq("id", data.rideId)
      .maybeSingle();

    if (!ride) throw new Error("Ride not found.");
    if (ride.rider_id !== userId && ride.driver_id !== userId) {
      throw new Error("You don't have access to this conversation.");
    }

    const senderId = data.as === "rider" ? ride.rider_id : ride.driver_id;
    if (!senderId) throw new Error("This ride has no driver assigned.");

    const { data: row, error } = await supabaseAdmin
      .from("messages")
      .insert({
        ride_id: data.rideId,
        sender_id: senderId,
        body: data.body,
      })
      .select("id, ride_id, sender_id, body, created_at")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

/**
 * Advance the demo driver's car one step along the route toward the
 * destination and insert a new `ride_locations` point. Riders watching the
 * demo ride see the car move in realtime (TrackMap subscribes to inserts), so
 * a single account can preview the Uber-style live tracking without a second
 * device sharing GPS. Only the demo ride's rider can trigger this.
 */
export const simulateDemoDriverLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rideId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<RideLocationDTO | null> => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: ride } = await supabaseAdmin
      .from("rides")
      .select(
        "id, rider_id, driver_id, pickup_lat, pickup_lng, destination_lat, destination_lng",
      )
      .eq("id", data.rideId)
      .maybeSingle();
    if (!ride) throw new Error("Ride not found.");
    if (ride.rider_id !== userId) throw new Error("This isn't your ride.");

    const demoDriverId = await ensureDemoDriverId(supabaseAdmin);
    if (ride.driver_id !== demoDriverId) {
      throw new Error("Live simulation is only available for demo rides.");
    }

    const pickup = {
      lat: ride.pickup_lat ?? DEMO_PICKUP.lat,
      lng: ride.pickup_lng ?? DEMO_PICKUP.lng,
    };
    const dest = {
      lat: ride.destination_lat ?? DEMO_DESTINATION.lat,
      lng: ride.destination_lng ?? DEMO_DESTINATION.lng,
    };

    // Continue from the last known point, otherwise start at pickup.
    const { data: last } = await supabaseAdmin
      .from("ride_locations")
      .select("lat, lng")
      .eq("ride_id", data.rideId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const from = last ? { lat: last.lat, lng: last.lng } : pickup;

    // Move ~20% of the remaining distance each tick (ease toward the target).
    const STEP = 0.2;
    const nextLat = from.lat + (dest.lat - from.lat) * STEP;
    const nextLng = from.lng + (dest.lng - from.lng) * STEP;

    // Compass heading (degrees clockwise from north) toward the destination.
    const heading =
      (Math.atan2(dest.lng - from.lng, dest.lat - from.lat) * 180) / Math.PI;
    const normHeading = (heading + 360) % 360;

    const { data: row, error } = await supabaseAdmin
      .from("ride_locations")
      .insert({
        ride_id: data.rideId,
        driver_id: demoDriverId,
        lat: nextLat,
        lng: nextLng,
        heading: normHeading,
      })
      .select("lat, lng, heading, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as RideLocationDTO;
  });
