import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PetDTO {
  id: string;
  name: string;
  pet_type: "dog" | "cat" | "other";
  breed: string | null;
  weight_lbs: number | null;
  notes: string | null;
  photo_url: string | null;
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
    return data ?? [];
  });

const createPetSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  pet_type: z.enum(["dog", "cat", "other"]).default("dog"),
  breed: z.string().trim().max(120).optional().nullable(),
  weight_lbs: z.number().min(0).max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

/** Create a pet owned by the signed-in user. */
export const createPet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createPetSchema.parse(input))
  .handler(async ({ data, context }): Promise<PetDTO> => {
    const { supabase, userId } = context;
    const { data: pet, error } = await supabase
      .from("pets")
      .insert({
        owner_id: userId,
        name: data.name,
        pet_type: data.pet_type,
        breed: data.breed ?? null,
        weight_lbs: data.weight_lbs ?? null,
        notes: data.notes ?? null,
      })
      .select("id, name, pet_type, breed, weight_lbs, notes, photo_url")
      .single();

    if (error) throw new Error(error.message);
    return pet;
  });
