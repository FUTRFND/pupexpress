import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PET_PHOTO_BUCKET = "pet-photos";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

export interface PetDTO {
  id: string;
  name: string;
  pet_type: "dog" | "cat" | "other";
  breed: string | null;
  weight_lbs: number | null;
  notes: string | null;
  /** Stored storage object path (owner-scoped). */
  photo_path: string | null;
  /** Short-lived signed URL for displaying the photo; null when none. */
  photo_url: string | null;
}

/** Turn a stored object path into a short-lived signed URL for display. */
async function signPhoto(
  supabase: { storage: { from: (b: string) => { createSignedUrl: (p: string, t: number) => Promise<{ data: { signedUrl: string } | null }> } } },
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from(PET_PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

/** List the signed-in user's pets, newest first. */
export const listPets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PetDTO[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("pets")
      .select("id, name, pet_type, breed, weight_lbs, notes, photo_url")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return Promise.all(
      (data ?? []).map(async (pet) => ({
        id: pet.id,
        name: pet.name,
        pet_type: pet.pet_type,
        breed: pet.breed,
        weight_lbs: pet.weight_lbs,
        notes: pet.notes,
        photo_path: pet.photo_url,
        photo_url: await signPhoto(supabase, pet.photo_url),
      })),
    );
  });

const createPetSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  pet_type: z.enum(["dog", "cat", "other"]).default("dog"),
  breed: z.string().trim().max(120).optional().nullable(),
  weight_lbs: z.number().min(0).max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  photo_path: z.string().trim().max(400).optional().nullable(),
});

/** Create a pet owned by the signed-in user. */
export const createPet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createPetSchema.parse(input))
  .handler(async ({ data, context }): Promise<PetDTO> => {
    const { supabase, userId } = context;

    // Guard: a supplied photo path must live inside the user's own folder.
    if (data.photo_path && !data.photo_path.startsWith(`${userId}/`)) {
      throw new Error("Invalid photo path.");
    }

    const { data: pet, error } = await supabase
      .from("pets")
      .insert({
        owner_id: userId,
        name: data.name,
        pet_type: data.pet_type,
        breed: data.breed ?? null,
        weight_lbs: data.weight_lbs ?? null,
        notes: data.notes ?? null,
        photo_url: data.photo_path ?? null,
      })
      .select("id, name, pet_type, breed, weight_lbs, notes, photo_url")
      .single();

    if (error) throw new Error(error.message);
    return {
      id: pet.id,
      name: pet.name,
      pet_type: pet.pet_type,
      breed: pet.breed,
      weight_lbs: pet.weight_lbs,
      notes: pet.notes,
      photo_path: pet.photo_url,
      photo_url: await signPhoto(supabase, pet.photo_url),
    };
  });

/** Delete a pet owned by the signed-in user (and its photo, best-effort). */
export const deletePet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ petId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;

    const { data: pet } = await supabase
      .from("pets")
      .select("photo_url")
      .eq("id", data.petId)
      .eq("owner_id", userId)
      .maybeSingle();

    const { error } = await supabase
      .from("pets")
      .delete()
      .eq("id", data.petId)
      .eq("owner_id", userId);

    if (error) throw new Error(error.message);

    if (pet?.photo_url) {
      await supabase.storage.from(PET_PHOTO_BUCKET).remove([pet.photo_url]);
    }

    return { id: data.petId };
  });
