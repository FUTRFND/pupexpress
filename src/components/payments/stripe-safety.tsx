import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";

import { getStripeSafetyStatus } from "@/lib/stripe-safety.functions";

/**
 * Reads the server-confirmed Stripe safety status (mode + whether write actions
 * are allowed). Cached for the session; payment UI uses it to disable buttons
 * and show the live-mode warning.
 */
export function useStripeSafety() {
  const statusFn = useServerFn(getStripeSafetyStatus);
  return useQuery({
    queryKey: ["stripe-safety"],
    queryFn: () => statusFn(),
    staleTime: 60_000,
  });
}

/**
 * Warning banner shown whenever Stripe is NOT safe for testing (live mode
 * without launch mode, or unknown key). Renders nothing when actions are safe.
 */
export function StripeLiveModeBanner({ className }: { className?: string }) {
  const { data } = useStripeSafety();
  if (!data || data.actionsAllowed) return null;

  const isLive = data.mode === "live";

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground ${className ?? ""}`}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="space-y-0.5">
        <p className="font-medium">
          {isLive
            ? "Stripe is currently in LIVE mode. Payment testing is disabled."
            : "Stripe key mode is unverified. Payment testing is disabled."}
        </p>
        <p className="text-xs text-muted-foreground">
          Connect onboarding, checkout, payouts, and transfers are blocked until
          test keys are installed (or launch mode is enabled in production).
        </p>
      </div>
    </div>
  );
}
