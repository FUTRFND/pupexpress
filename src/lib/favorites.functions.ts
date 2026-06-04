import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface FavoriteLocationDTO {
  id: string;
  label: string;
  address: string;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

const FAVORITE_COLUMNS = "id, label, address, place_id, lat, lng, created_at";

/** List the signed-in rider's saved favorite locations, newest first. */
export const listFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FavoriteLocationDTO[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("favorite_locations")
      .select(FAVORITE_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as FavoriteLocationDTO[];
  });

const addFavoriteSchema = z.object({
  label: z.string().trim().min(1, "Add a short label").max(60),
  address: z.string().trim().min(1, "Address is required").max(300),
  placeId: z.string().trim().max(300).optional().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Save a new favorite location for the signed-in rider. */
export const addFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addFavoriteSchema.parse(input))
  .handler(async ({ data, context }): Promise<FavoriteLocationDTO> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("favorite_locations")
      .insert({
        user_id: userId,
        label: data.label,
        address: data.address,
        place_id: data.placeId ?? null,
        lat: data.lat,
        lng: data.lng,
      })
      .select(FAVORITE_COLUMNS)
      .single();

    if (error) throw new Error(error.message);
    return row as FavoriteLocationDTO;
  });

/** Delete one of the signed-in rider's favorite locations. */
export const deleteFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("favorite_locations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { id: data.id };
  });
