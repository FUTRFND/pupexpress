import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const USER_STORAGE_BUCKETS = ["pet-photos", "driver-documents"] as const;

async function removeStorageFolder(bucket: string, folder: string): Promise<void> {
  const storage = supabaseAdmin.storage.from(bucket);
  const { data, error } = await storage.list(folder, { limit: 1000 });
  if (error) throw new Error(`Could not remove account files from ${bucket}.`);

  const files = (data ?? []).filter((item) => item.id).map((item) => `${folder}/${item.name}`);
  const folders = (data ?? []).filter((item) => !item.id);

  for (const child of folders) {
    await removeStorageFolder(bucket, `${folder}/${child.name}`);
  }

  if (files.length) {
    const { error: removeError } = await storage.remove(files);
    if (removeError) throw new Error(`Could not remove account files from ${bucket}.`);
  }
}

async function assertDelete(error: { message: string } | null, label: string) {
  if (error) throw new Error(`Could not delete ${label}. Please try again.`);
}

/** Permanently delete the authenticated user and their PupXpress personal data. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ deleted: true }> => {
    const { userId } = context;

    for (const bucket of USER_STORAGE_BUCKETS) {
      await removeStorageFolder(bucket, userId);
    }

    await assertDelete(
      (await supabaseAdmin.from("ride_ratings").delete().or(`rider_id.eq.${userId},driver_id.eq.${userId}`)).error,
      "ratings",
    );
    await assertDelete(
      (await supabaseAdmin.from("referral_usage").delete().eq("used_by_user_id", userId)).error,
      "referral history",
    );
    await assertDelete(
      (await supabaseAdmin.from("referral_codes").delete().eq("user_id", userId)).error,
      "referral code",
    );
    await assertDelete(
      (await supabaseAdmin.from("favorite_locations").delete().eq("user_id", userId)).error,
      "saved locations",
    );
    await assertDelete(
      (await supabaseAdmin.from("driver_verifications").delete().eq("user_id", userId)).error,
      "driver verification",
    );

    // Deleting auth.users cascades through profiles, pets, rides, messages,
    // notifications, device tokens, roles, and driver presence.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error("Could not delete your account. Please try again.");

    return { deleted: true };
  });
