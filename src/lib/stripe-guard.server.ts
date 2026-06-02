import process from "node:process";

/**
 * Centralized Stripe safety gate.
 *
 * Goal: during development the app must NEVER execute real money-movement
 * actions (connected-account creation, checkout sessions, transfers, payouts)
 * while a LIVE secret key is configured. This module is the single source of
 * truth used by every Stripe write path on the server.
 *
 * Rules:
 *   - TEST mode key  -> actions always allowed (safe sandbox).
 *   - LIVE mode key  -> actions BLOCKED unless launch mode is explicitly on.
 *   - Launch mode    -> opt-in via STRIPE_LAUNCH_MODE="true" (production only).
 *
 * The default (no STRIPE_LAUNCH_MODE set) is the SAFE default: live actions
 * are blocked.
 */

export type StripeMode = "test" | "live" | "unknown";

export function getStripeMode(): StripeMode {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  return "unknown";
}

/** Explicit production launch opt-in. Defaults OFF (safe). */
export function isLaunchModeEnabled(): boolean {
  return (process.env.STRIPE_LAUNCH_MODE ?? "").toLowerCase() === "true";
}

export interface StripeSafety {
  mode: StripeMode;
  launchMode: boolean;
  /** True only when it is safe to execute real Stripe write actions. */
  actionsAllowed: boolean;
  reason: string;
}

export function getStripeSafety(): StripeSafety {
  const mode = getStripeMode();
  const launchMode = isLaunchModeEnabled();

  // TEST keys are always safe. LIVE keys only when launch mode is explicitly on.
  // UNKNOWN keys are treated as unsafe (fail closed).
  const actionsAllowed = mode === "test" || (mode === "live" && launchMode);

  let reason: string;
  if (mode === "test") {
    reason = "Stripe is in TEST mode — safe to run payment actions.";
  } else if (mode === "live" && !launchMode) {
    reason =
      "Stripe is in LIVE mode and launch mode is OFF — payment actions are disabled.";
  } else if (mode === "live" && launchMode) {
    reason = "Stripe is in LIVE mode with launch mode ON — actions enabled.";
  } else {
    reason =
      "Stripe key mode is UNKNOWN — payment actions are disabled (fail closed).";
  }

  return { mode, launchMode, actionsAllowed, reason };
}

/**
 * Throw a clear, client-safe error if Stripe write actions are not allowed.
 * Call this at the top of every server handler that moves money or creates
 * Stripe resources (accounts, account links, checkout sessions, transfers).
 */
export function assertStripeActionsAllowed(action: string): void {
  const safety = getStripeSafety();
  if (!safety.actionsAllowed) {
    throw new Error(
      `Blocked: "${action}" is disabled. ${safety.reason} ` +
        `Install Stripe TEST keys (or enable launch mode in production) to proceed.`,
    );
  }
}
