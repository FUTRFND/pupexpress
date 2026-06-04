import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripe, computeFees, toMinorUnits } from "./stripe.server";
import {
  ensureStripeCustomer,
  recordCheckoutPayment,
  markRidePaid,
} from "./payments.server";
import { assertStripeActionsAllowed } from "./stripe-guard.server";

/** States in which a rider is allowed to start (or retry) payment. */
const PAYABLE_PAYMENT_STATUSES = ["unpaid", "payment_failed"];

function resolveOrigin(): string {
  const origin = getRequestHeader("origin");
  if (origin) return origin;
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "";
  }
}

export interface CheckoutResult {
  url: string;
}

/**
 * Create (or reuse) a Stripe Checkout Session for a completed ride the
 * signed-in rider owns. RLS scopes the read/write to the rider; all Stripe
 * secret handling stays server-side.
 */
export const createRideCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        rideId: z.string().uuid(),
        // Optional rider tip (currency units). Goes 100% to the driver.
        tip: z.number().min(0).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    // SAFETY: block live-mode checkout sessions unless launch mode is on.
    assertStripeActionsAllowed("Checkout");
    const { supabase, userId } = context;

    const { data: ride, error } = await supabase
      .from("rides")
      .select(
        "id, status, payment_status, driver_id, ride_total, pickup_address, destination_address, stripe_checkout_session_id",
      )
      .eq("id", data.rideId)
      .eq("rider_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ride) throw new Error("Ride not found.");
    if (ride.status !== "completed") {
      throw new Error("This ride isn't ready for payment yet.");
    }
    if (!ride.driver_id) {
      throw new Error("This ride has no assigned driver.");
    }
    if (ride.payment_status === "paid") {
      throw new Error("This ride is already paid.");
    }
    const tip = Math.round(Math.max(0, data.tip ?? 0) * 100) / 100;
    if (!PAYABLE_PAYMENT_STATUSES.includes(ride.payment_status)) {
      // payment_pending: try to reuse the open session before making a new one.
      // Skip reuse when a tip is requested so the new amount is reflected.
      if (ride.stripe_checkout_session_id && tip === 0) {
        const stripe = getStripe();
        const existing = await stripe.checkout.sessions.retrieve(
          ride.stripe_checkout_session_id,
        );
        if (existing.status === "open" && existing.url) {
          return { url: existing.url };
        }
      }
    }

    const fees = computeFees(ride.ride_total);
    // The tip is added on top of the fare and paid out entirely to the driver
    // (no platform fee on tips).
    const driverEarningsWithTip = Math.round((fees.driverEarnings + tip) * 100) / 100;
    const chargedTotal = Math.round((fees.rideTotal + tip) * 100) / 100;
    const origin = resolveOrigin();

    // Load rider contact details for the Stripe customer.
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    const customerId = await ensureStripeCustomer({
      riderId: userId,
      email: profile?.email ?? null,
      name: profile?.full_name ?? null,
    });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: fees.currency,
            unit_amount: toMinorUnits(fees.rideTotal),
            product_data: {
              name: "PupXpress ride",
              description: `${ride.pickup_address} → ${ride.destination_address}`,
            },
          },
        },
        ...(tip > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: fees.currency,
                  unit_amount: toMinorUnits(tip),
                  product_data: {
                    name: "Driver tip",
                    description: "100% goes to your driver",
                  },
                },
              },
            ]
          : []),
      ],
      payment_intent_data: {
        transfer_group: `ride_${ride.id}`,
        metadata: {
          ride_id: ride.id,
          rider_id: userId,
          driver_id: ride.driver_id,
          platform_fee: String(fees.platformFee),
          driver_earnings: String(driverEarningsWithTip),
          tip_amount: String(tip),
        },
      },
      metadata: {
        ride_id: ride.id,
        rider_id: userId,
        driver_id: ride.driver_id,
        platform_fee: String(fees.platformFee),
        driver_earnings: String(driverEarningsWithTip),
        tip_amount: String(tip),
      },
      success_url: `${origin}/trips?payment=success&ride=${ride.id}`,
      cancel_url: `${origin}/trips?payment=cancelled&ride=${ride.id}`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    // Persist the computed amounts + session id on the ride. Financial columns
    // are locked to the service role by a DB trigger, so this write goes through
    // the admin client; the ride id + rider_id predicate keeps it scoped to the
    // ride we already verified the caller owns above.
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error: updateError } = await supabaseAdmin
      .from("rides")
      .update({
        ride_total: fees.rideTotal,
        platform_fee: fees.platformFee,
        driver_earnings: driverEarningsWithTip,
        tip_amount: tip,
        payment_status: "payment_pending",
        stripe_checkout_session_id: session.id,
      })
      .eq("id", ride.id)
      .eq("rider_id", userId);
    if (updateError) throw new Error(updateError.message);

    // Ledger row (admin-side; riders cannot insert into payments).
    await recordCheckoutPayment({
      rideId: ride.id,
      riderId: userId,
      amount: chargedTotal,
      platformFee: fees.platformFee,
      currency: fees.currency,
      sessionId: session.id,
    });

    return { url: session.url };
  });

export interface ConfirmPaymentResult {
  paid: boolean;
  status: "paid" | "pending" | "unpaid";
}

/**
 * Actively verify a Stripe Checkout session on return from Checkout so the
 * ride is marked paid immediately, without waiting on the webhook. The webhook
 * remains the source of truth / fallback; this just removes the confirmation
 * lag for the rider. Idempotent — `markRidePaid` no-ops if already paid.
 */
export const confirmRidePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rideId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ConfirmPaymentResult> => {
    const { supabase, userId } = context;

    // RLS scopes this read to the signed-in rider — confirms ownership.
    const { data: ride, error } = await supabase
      .from("rides")
      .select("id, payment_status, stripe_checkout_session_id")
      .eq("id", data.rideId)
      .eq("rider_id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ride) throw new Error("Ride not found.");

    if (ride.payment_status === "paid") {
      return { paid: true, status: "paid" };
    }
    if (!ride.stripe_checkout_session_id) {
      return { paid: false, status: "unpaid" };
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(
      ride.stripe_checkout_session_id,
    );

    // Guard: the session must belong to this ride.
    if (session.metadata?.ride_id && session.metadata.ride_id !== ride.id) {
      return { paid: false, status: "pending" };
    }

    if (session.payment_status === "paid") {
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      await markRidePaid(ride.id, {
        paymentIntentId,
        checkoutSessionId: session.id,
      });
      return { paid: true, status: "paid" };
    }

    return { paid: false, status: "pending" };
  });
