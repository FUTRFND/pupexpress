import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import process from "node:process";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripe, getFeeConfig } from "./stripe.server";
import { assertStripeActionsAllowed } from "./stripe-guard.server";

function resolveOrigin(): string {
  const origin = getRequestHeader("origin");
  if (origin) return origin;
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "";
  }
}

/** Detect whether the configured Stripe secret key is a test or live key. */
function stripeMode(): "test" | "live" | "unknown" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  return "unknown";
}

/**
 * Normalize a Stripe SDK error into a structured payload, log the full detail
 * server-side (so it surfaces in server-function logs), and return a single
 * human-readable line containing every field Stripe Support asks for.
 *
 * Returning a clean string lets the caller `throw new Error(...)`, which the
 * client mutation catches via `onError` and shows as a toast — instead of the
 * raw Stripe error object bubbling up and blank-screening the app.
 */
function describeStripeError(err: unknown, endpoint: string): string {
  const e = err as {
    type?: string;
    code?: string;
    message?: string;
    requestId?: string;
    statusCode?: number;
    raw?: { message?: string };
  };
  const payload = {
    endpoint,
    accountType: "express",
    requestedCapabilities: ["transfers"],
    mode: stripeMode(),
    type: e?.type ?? null,
    code: e?.code ?? null,
    statusCode: e?.statusCode ?? null,
    requestId: e?.requestId ?? null,
    message: e?.message ?? e?.raw?.message ?? String(err),
  };
  // Full structured payload for server-function logs.
  console.error("[stripe:connect] error", JSON.stringify(payload));

  return (
    `Stripe ${endpoint} failed — ` +
    `type=${payload.type} code=${payload.code} status=${payload.statusCode} ` +
    `requestId=${payload.requestId} mode=${payload.mode} ` +
    `account=express capability=transfers — ${payload.message}`
  );
}

export interface DriverPayoutStatus {
  hasAccount: boolean;
  onboardingStatus: string;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
}

export interface OnboardingLink {
  url: string;
}

/**
 * Create a Stripe Express connected account for the signed-in driver (if one
 * doesn't exist) and return a hosted onboarding link. The connected account id
 * is stored on the driver's profile (RLS-scoped to self).
 */
export const createDriverOnboardingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingLink> => {
    // SAFETY: never create connected accounts / onboarding links in live mode
    // unless launch mode is explicitly enabled.
    assertStripeActionsAllowed("Connect onboarding");
    const { supabase, userId } = context;
    const stripe = getStripe();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("stripe_connected_account_id, email")
      .eq("id", userId)
      .single();
    if (error) throw new Error(error.message);

    let accountId = profile?.stripe_connected_account_id ?? null;

    if (!accountId) {
      let account;
      try {
        account = await stripe.accounts.create({
          type: "express",
          country: process.env.STRIPE_CONNECT_COUNTRY ?? "US",
          email: profile?.email ?? undefined,
          business_type: "individual",
          capabilities: {
            transfers: { requested: true },
          },
          metadata: { driver_id: userId },
        });
      } catch (err) {
        throw new Error(describeStripeError(err, "accounts.create"));
      }
      accountId = account.id;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          stripe_connected_account_id: accountId,
          driver_onboarding_status: "pending",
        })
        .eq("id", userId);
      if (updateError) throw new Error(updateError.message);
    }

    const origin = resolveOrigin();
    let link;
    try {
      link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${origin}/profile?connect=refresh`,
        return_url: `${origin}/profile?connect=return`,
        type: "account_onboarding",
      });
    } catch (err) {
      throw new Error(describeStripeError(err, "accountLinks.create"));
    }

    return { url: link.url };
  });

/**
 * Pull the live connected-account status from Stripe and persist the
 * capability flags onto the driver's profile.
 */
export const refreshDriverPayoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriverPayoutStatus> => {
    const { supabase, userId } = context;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "stripe_connected_account_id, driver_onboarding_status, driver_payouts_enabled, driver_charges_enabled",
      )
      .eq("id", userId)
      .single();
    if (error) throw new Error(error.message);

    if (!profile?.stripe_connected_account_id) {
      return {
        hasAccount: false,
        onboardingStatus: profile?.driver_onboarding_status ?? "not_started",
        payoutsEnabled: false,
        chargesEnabled: false,
      };
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(
      profile.stripe_connected_account_id,
    );

    const onboarding = account.details_submitted
      ? account.payouts_enabled
        ? "complete"
        : "restricted"
      : "pending";

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        driver_charges_enabled: Boolean(account.charges_enabled),
        driver_payouts_enabled: Boolean(account.payouts_enabled),
        driver_onboarding_status: onboarding,
      })
      .eq("id", userId);
    if (updateError) throw new Error(updateError.message);

    return {
      hasAccount: true,
      onboardingStatus: onboarding,
      payoutsEnabled: Boolean(account.payouts_enabled),
      chargesEnabled: Boolean(account.charges_enabled),
    };
  });

/** Read the driver's current (locally stored) payout status without a Stripe call. */
export const getDriverPayoutStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriverPayoutStatus> => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(
        "stripe_connected_account_id, driver_onboarding_status, driver_payouts_enabled, driver_charges_enabled",
      )
      .eq("id", userId)
      .single();
    if (error) throw new Error(error.message);

    return {
      hasAccount: Boolean(profile?.stripe_connected_account_id),
      onboardingStatus: profile?.driver_onboarding_status ?? "not_started",
      payoutsEnabled: Boolean(profile?.driver_payouts_enabled),
      chargesEnabled: Boolean(profile?.driver_charges_enabled),
    };
  });

export interface EarningsSummary {
  today: number;
  pending: number;
  allTime: number;
  currency: string;
}

/**
 * Earnings summary for the signed-in driver, derived from their assigned rides:
 *   - today:    earnings on rides completed today
 *   - pending:  paid + completed rides not yet transferred to the driver
 *   - allTime:  earnings already transferred (driver_paid)
 */
export const getDriverEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EarningsSummary> => {
    const { supabase, userId } = context;
    const { data: rides, error } = await supabase
      .from("rides")
      .select(
        "driver_earnings, payment_status, transfer_status, status, completed_at",
      )
      .eq("driver_id", userId);
    if (error) throw new Error(error.message);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let today = 0;
    let pending = 0;
    let allTime = 0;

    for (const r of rides ?? []) {
      const amount = Number(r.driver_earnings ?? 0);
      if (amount <= 0) continue;

      if (r.transfer_status === "driver_paid") {
        allTime += amount;
        if (r.completed_at && new Date(r.completed_at) >= startOfToday) {
          today += amount;
        }
      } else if (
        r.status === "completed" &&
        r.payment_status === "paid"
      ) {
        pending += amount;
      }
    }

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    return {
      today: round2(today),
      pending: round2(pending),
      allTime: round2(allTime),
      currency: getFeeConfig().currency,
    };
  });

export interface DriverEarningRow {
  rideId: string;
  pickupAddress: string;
  destinationAddress: string;
  rideTotal: number;
  platformFee: number;
  driverEarnings: number;
  status: string;
  paymentStatus: string;
  transferStatus: string;
  completedAt: string | null;
  createdAt: string;
}

/**
 * Per-ride earnings history for the signed-in driver. Lists every ride the
 * driver was assigned to that produced (or will produce) earnings, newest
 * first, so the driver can reconcile each payout against a specific trip.
 */
export const listDriverEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriverEarningRow[]> => {
    const { supabase, userId } = context;
    const { data: rides, error } = await supabase
      .from("rides")
      .select(
        "id, pickup_address, destination_address, ride_total, platform_fee, driver_earnings, status, payment_status, transfer_status, completed_at, created_at",
      )
      .eq("driver_id", userId)
      .gt("driver_earnings", 0)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    return (rides ?? []).map((r) => ({
      rideId: r.id,
      pickupAddress: r.pickup_address,
      destinationAddress: r.destination_address,
      rideTotal: Number(r.ride_total ?? 0),
      platformFee: Number(r.platform_fee ?? 0),
      driverEarnings: Number(r.driver_earnings ?? 0),
      status: r.status,
      paymentStatus: r.payment_status,
      transferStatus: r.transfer_status,
      completedAt: r.completed_at,
      createdAt: r.created_at,
    }));
  });
