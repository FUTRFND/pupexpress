import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripeSafety } from "./stripe-guard.server";

export interface StripeSafetyStatus {
  mode: "test" | "live" | "unknown";
  launchMode: boolean;
  actionsAllowed: boolean;
  reason: string;
}

/**
 * Client-readable Stripe safety status. Returns only the mode + whether actions
 * are allowed — never the secret key itself. Used to render the live-mode
 * warning banner and to disable payment/onboarding buttons.
 */
export const getStripeSafetyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<StripeSafetyStatus> => {
    const { mode, launchMode, actionsAllowed, reason } = getStripeSafety();
    return { mode, launchMode, actionsAllowed, reason };
  });
