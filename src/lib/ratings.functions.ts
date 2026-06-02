import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface RideRatingDTO {
  id: string;
  ride_id: string;
  rider_id: string;
  driver_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

const submitSchema = z.object({
  rideId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().nullable(),
});

/**
 * Submit (or update) a rider's rating for a completed ride. We re-verify that
 * the caller is the rider on a completed ride before writing — RLS already
 * scopes inserts to auth.uid() = rider_id, this adds the business rules
 * (completed status, has a driver, one rating per ride via upsert).
 */
export const submitRideRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data, context }): Promise<RideRatingDTO> => {
    const { supabase, userId } = context;

    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("id, rider_id, driver_id, status")
      .eq("id", data.rideId)
      .maybeSingle();
    if (rideErr) throw new Error(rideErr.message);
    if (!ride) throw new Error("Ride not found.");
    if (ride.rider_id !== userId)
      throw new Error("Only the rider can rate this ride.");
    if (ride.status !== "completed")
      throw new Error("You can only rate completed rides.");
    if (!ride.driver_id) throw new Error("This ride has no driver to rate.");

    const { data: row, error } = await supabase
      .from("ride_ratings")
      .upsert(
        {
          ride_id: data.rideId,
          rider_id: userId,
          driver_id: ride.driver_id,
          rating: data.rating,
          comment: data.comment?.trim() ? data.comment.trim() : null,
        },
        { onConflict: "ride_id" },
      )
      .select("id, ride_id, rider_id, driver_id, rating, comment, created_at")
      .single();
    if (error) throw new Error(error.message);

    const { createNotifications } = await import("./notifications.server");
    await createNotifications([
      {
        user_id: ride.driver_id,
        title: `You received a ${data.rating}-star rating`,
        body: data.comment?.trim()
          ? data.comment.trim()
          : "A rider rated their ride with you.",
        type: "rating",
        ride_id: data.rideId,
      },
    ]);

    return row as RideRatingDTO;
  });

/**
 * Ratings visible to the signed-in user. For a rider this returns the ratings
 * they left (so the UI can show which rides are already rated); for a driver it
 * returns ratings about them. RLS handles the scoping.
 */
export const listMyRideRatings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RideRatingDTO[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("ride_ratings")
      .select("id, ride_id, rider_id, driver_id, rating, comment, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as RideRatingDTO[];
  });
