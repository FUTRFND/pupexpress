import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ProfileDTO {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  profile_photo_url: string | null;
}

const PROFILE_COLUMNS = "id, full_name, email, phone, profile_photo_url";

/** Fetch the signed-in user's profile row. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileDTO> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .single();

    if (error) throw new Error(error.message);
    return data as ProfileDTO;
  });

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+()\-.\s]*$/, "Enter a valid phone number")
    .optional()
    .nullable(),
});

/** Update the signed-in user's editable profile fields. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateProfileSchema.parse(input))
  .handler(async ({ data, context }): Promise<ProfileDTO> => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone?.trim() || null,
      })
      .eq("id", userId)
      .select(PROFILE_COLUMNS)
      .single();

    if (error) throw new Error(error.message);
    return profile as ProfileDTO;
  });
