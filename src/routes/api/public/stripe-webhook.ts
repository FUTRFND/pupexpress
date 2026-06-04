import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

import {
  getStripe,
  getStripeCryptoProvider,
  getWebhookSecret,
} from "@/lib/stripe.server";
import {
  markRidePaid,
  markPaymentFailed,
  markCancellationFeePaid,
  syncConnectAccount,
} from "@/lib/payments.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Stripe webhook endpoint.
 *
 * SECURITY:
 *   - Lives under /api/public so Stripe can reach it without app auth.
 *   - EVERY request is signature-verified against STRIPE_WEBHOOK_SECRET before
 *     any processing. Unverified requests are rejected with 400.
 *   - All record updates run with service-role privileges (server-side only).
 *   - Handlers are idempotent (see payments.server.ts), so Stripe retries and
 *     duplicate deliveries cannot double-charge or double-pay.
 */
export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return new Response("Missing signature", { status: 400 });
        }

        const body = await request.text();

        let event: Stripe.Event;
        try {
          const stripe = getStripe();
          event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            getWebhookSecret(),
            undefined,
            getStripeCryptoProvider(),
          );
        } catch (err) {
          console.error("Stripe webhook signature verification failed", err);
          return new Response("Invalid signature", { status: 400 });
        }

        try {
          await handleEvent(event);
        } catch (err) {
          console.error(`Error handling Stripe event ${event.type}`, err);
          // 500 → Stripe retries; handlers are idempotent so retries are safe.
          return new Response("Handler error", { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const rideId = session.metadata?.ride_id;
      if (!rideId) return;
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      await markRidePaid(rideId, {
        paymentIntentId,
        checkoutSessionId: session.id,
      });
      break;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const rideId = pi.metadata?.ride_id;
      if (!rideId) return;
      await markRidePaid(rideId, { paymentIntentId: pi.id });
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const rideId = pi.metadata?.ride_id;
      if (!rideId) return;
      await markPaymentFailed(rideId);
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await syncConnectAccount({
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
      });
      break;
    }

    case "transfer.created": {
      const transfer = event.data.object as Stripe.Transfer;
      const rideId = transfer.metadata?.ride_id;
      if (!rideId) return;
      // Reconcile (idempotent) — the transfer was initiated server-side.
      await supabaseAdmin
        .from("rides")
        .update({
          transfer_status: "driver_paid",
          stripe_transfer_id: transfer.id,
        })
        .eq("id", rideId)
        .neq("transfer_status", "driver_paid");
      break;
    }

    case "transfer.failed" as Stripe.Event["type"]: {
      const transfer = event.data.object as Stripe.Transfer;
      const rideId = transfer.metadata?.ride_id;
      if (!rideId) return;
      await supabaseAdmin
        .from("rides")
        .update({ transfer_status: "transfer_failed" })
        .eq("id", rideId);
      await supabaseAdmin
        .from("driver_earnings")
        .update({ transfer_status: "transfer_failed" })
        .eq("ride_id", rideId);
      break;
    }

    default:
      // Unhandled event types are acknowledged with 200 (no-op).
      break;
  }
}
