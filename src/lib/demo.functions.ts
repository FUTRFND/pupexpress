import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Stable identity for the simulated driver used in demo conversations. This is a
 * plain profile row (no auth user) so a single real account can chat with
 * "itself" and exercise the full rider <-> driver messaging flow.
 */
export const DEMO_DRIVER_ID = "00000000-0000-4000-8000-00000000d00d";
const DEMO_DRIVER_NAME = "Demo Driver";

/**
 * Create (or reuse) a demo conversation: a ride where the signed-in user is the
 * rider and a synthetic "Demo Driver" is the counterpart. Lets a single account
 * test the in-app chat end to end. Uses the admin client because it writes a
 * profile + ride row that RLS would otherwise block.
 */
export const createDemoConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rideId: string }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Ensure the synthetic driver profile exists.
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: DEMO_DRIVER_ID,
          full_name: DEMO_DRIVER_NAME,
          role: "driver",
        },
        { onConflict: "id" },
      );

    // Reuse an existing demo ride for this user if one is already open.
    const { data: existing } = await supabaseAdmin
      .from("rides")
      .select("id")
      .eq("rider_id", userId)
      .eq("driver_id", DEMO_DRIVER_ID)
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
        driver_id: DEMO_DRIVER_ID,
        status: "accepted",
        pickup_address: "123 Bark Avenue (Demo)",
        destination_address: "Sunnyside Dog Park (Demo)",
        accepted_at: now,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    // Seed a friendly opener from the demo driver.
    await supabaseAdmin.from("messages").insert({
      ride_id: ride.id,
      sender_id: DEMO_DRIVER_ID,
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
