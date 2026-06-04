import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const platformSchema = z.enum(["web", "ios", "android"]);

/**
 * Register (or refresh) a push device token for the signed-in user.
 *
 * Tokens are unique per device. If the same token already exists we update its
 * owner/platform so a device that switches accounts is re-pointed correctly.
 * RLS scopes all writes to the authenticated user.
 */
export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().min(8).max(4096),
        platform: platformSchema.default("web"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("device_tokens")
      .upsert(
        {
          user_id: userId,
          token: data.token,
          platform: data.platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove a device token (e.g. on sign-out or when push is disabled). */
export const unregisterDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(8).max(4096) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase } = context;
    const { error } = await supabase
      .from("device_tokens")
      .delete()
      .eq("token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
