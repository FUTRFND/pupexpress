import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getStripe, computeFees, toMinorUnits, getFeeConfig } from "./stripe.server";
import { getStripeSafety } from "./stripe-guard.server";

/**
 * Get (or lazily create) the Stripe customer for a rider and persist its id.
 * Returns the customer id. Server-only; uses the admin client.
 */
export async function ensureStripeCustomer(opts: {
  riderId: string;
  email: string | null;
  name: string | null;
}): Promise<string> {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", opts.riderId)
    .single();
  if (error) throw new Error(error.message);

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: opts.email ?? undefined,
    name: opts.name ?? undefined,
    metadata: { rider_id: opts.riderId },
  });

  await supabaseAdmin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", opts.riderId);

  return customer.id;
}

/** Upsert the payments ledger row when a checkout session is created. */
export async function recordCheckoutPayment(opts: {
  rideId: string;
  riderId: string;
  amount: number;
  platformFee: number;
  currency: string;
  sessionId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("payments").upsert(
    {
      ride_id: opts.rideId,
      rider_id: opts.riderId,
      amount: opts.amount,
      platform_fee: opts.platformFee,
      currency: opts.currency,
      status: "payment_pending",
      stripe_checkout_session_id: opts.sessionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "ride_id" },
  );
  if (error) throw new Error(error.message);
}


/**
 * Server-only payment + payout engine. Uses the service-role client
 * (RLS-bypassing) and is reachable ONLY from server functions and the
 * verified webhook route — never from client code (`.server.ts` is
 * import-protected out of client bundles).
 *
 * Every state transition is written with a conditional WHERE clause so the
 * operation is idempotent and safe under duplicate webhook delivery:
 *   - a ride is marked paid only if it is not already paid
 *   - a transfer is claimed only from the `not_ready` state (atomic)
 * Combined with the unique indexes on payments(ride_id) and
 * driver_earnings(ride_id), duplicate charges/transfers cannot occur.
 */

interface PaidPatch {
  paymentIntentId?: string | null;
  checkoutSessionId?: string | null;
}

/** Mark a ride paid (idempotent) and attempt the driver transfer. */
export async function markRidePaid(rideId: string, patch: PaidPatch): Promise<void> {
  const update: {
    payment_status: "paid";
    paid_at: string;
    stripe_payment_intent_id?: string;
    stripe_checkout_session_id?: string;
  } = {
    payment_status: "paid",
    paid_at: new Date().toISOString(),
  };
  if (patch.paymentIntentId) update.stripe_payment_intent_id = patch.paymentIntentId;
  if (patch.checkoutSessionId) update.stripe_checkout_session_id = patch.checkoutSessionId;

  const { data, error } = await supabaseAdmin
    .from("rides")
    .update(update)
    .eq("id", rideId)
    .neq("payment_status", "paid")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);

  // Keep the payments ledger row in sync (created at checkout time).
  await supabaseAdmin
    .from("payments")
    .update({
      status: "paid",
      stripe_payment_intent_id: patch.paymentIntentId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("ride_id", rideId);

  // Only attempt a transfer if THIS call is the one that flipped it to paid
  // (data non-null). A duplicate webhook updates 0 rows and skips the transfer.
  if (data) {
    await maybeCreateTransfer(rideId);
  }
}

/** Mark a ride's payment failed (never downgrades an already-paid ride). */
export async function markPaymentFailed(rideId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("rides")
    .update({ payment_status: "payment_failed" })
    .eq("id", rideId)
    .neq("payment_status", "paid");
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("payments")
    .update({ status: "payment_failed", updated_at: new Date().toISOString() })
    .eq("ride_id", rideId)
    .neq("status", "paid");
}

/**
 * Create a Stripe Connect transfer to the driver, if and only if the ride is
 * completed, paid, has an assigned driver with payouts enabled, and has not
 * already been transferred. The atomic claim (`not_ready` -> `transfer_pending`)
 * guarantees a single transfer even under concurrent/duplicate webhooks.
 */
export async function maybeCreateTransfer(rideId: string): Promise<void> {
  // Atomically claim the ride for transfer. All payout preconditions live in
  // this single WHERE clause.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("rides")
    .update({ transfer_status: "transfer_pending" })
    .eq("id", rideId)
    .eq("status", "completed")
    .eq("payment_status", "paid")
    .not("driver_id", "is", null)
    .eq("transfer_status", "not_ready")
    .select("id, driver_id, driver_earnings")
    .maybeSingle();

  if (claimError) throw new Error(claimError.message);
  if (!claimed) return; // not eligible yet, or already claimed/transferred.

  const driverId = claimed.driver_id as string;
  const driverEarnings = Number(claimed.driver_earnings ?? 0);

  // Verify the driver is actually able to receive payouts.
  const { data: driver, error: driverError } = await supabaseAdmin
    .from("profiles")
    .select("stripe_connected_account_id, driver_payouts_enabled")
    .eq("id", driverId)
    .single();

  if (driverError) throw new Error(driverError.message);

  const eligible =
    Boolean(driver?.stripe_connected_account_id) &&
    Boolean(driver?.driver_payouts_enabled) &&
    driverEarnings > 0;

  if (!eligible) {
    // Reset to not_ready so it can be retried once onboarding completes.
    await supabaseAdmin
      .from("rides")
      .update({ transfer_status: "not_ready" })
      .eq("id", rideId)
      .eq("transfer_status", "transfer_pending");
    return;
  }

  const cfg = getFeeConfig();
  try {
    const stripe = getStripe();
    const transfer = await stripe.transfers.create({
      amount: toMinorUnits(driverEarnings),
      currency: cfg.currency,
      destination: driver!.stripe_connected_account_id as string,
      transfer_group: `ride_${rideId}`,
      metadata: { ride_id: rideId, driver_id: driverId },
    });

    await supabaseAdmin
      .from("rides")
      .update({
        transfer_status: "driver_paid",
        stripe_transfer_id: transfer.id,
        transferred_at: new Date().toISOString(),
      })
      .eq("id", rideId);

    // Ledger row (unique per ride; ignore duplicate on conflict).
    await supabaseAdmin.from("driver_earnings").upsert(
      {
        ride_id: rideId,
        driver_id: driverId,
        amount: driverEarnings,
        currency: cfg.currency,
        transfer_status: "driver_paid",
        stripe_transfer_id: transfer.id,
        transferred_at: new Date().toISOString(),
      },
      { onConflict: "ride_id" },
    );
  } catch (err) {
    await supabaseAdmin
      .from("rides")
      .update({ transfer_status: "transfer_failed" })
      .eq("id", rideId);
    console.error("Driver transfer failed", rideId, err);
    throw err;
  }
}

/** Sync a connected account's capabilities back onto the driver profile. */
export async function syncConnectAccount(account: {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
}): Promise<void> {
  const onboarding = account.details_submitted
    ? account.payouts_enabled
      ? "complete"
      : "restricted"
    : "pending";

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      driver_charges_enabled: Boolean(account.charges_enabled),
      driver_payouts_enabled: Boolean(account.payouts_enabled),
      driver_onboarding_status: onboarding,
    })
    .eq("stripe_connected_account_id", account.id);

  if (error) throw new Error(error.message);
}

/** Re-export for callers that need the same fee math server-side. */
export { computeFees };
