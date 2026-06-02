import { createFileRoute } from "@tanstack/react-router";
import process from "node:process";

import { getStripe } from "@/lib/stripe.server";

/**
 * TEMPORARY diagnostic endpoint — Stripe runtime environment audit.
 *
 * Reads the ACTUAL secrets loaded by the running server (process.env), then
 * performs live Stripe calls (account + balance retrieve) so we can prove which
 * mode the runtime is operating in. Returns only masked key prefixes — never the
 * full secret. Delete this route once the audit is complete.
 */

function classify(key: string): "test" | "live" | "unknown" {
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  return "unknown";
}

function mask(value: string | undefined): {
  present: boolean;
  prefix: string | null;
  length: number;
} {
  if (!value) return { present: false, prefix: null, length: 0 };
  return {
    present: true,
    prefix: value.slice(0, 10),
    length: value.length,
  };
}

export const Route = createFileRoute("/api/public/stripe-audit")({
  server: {
    handlers: {
      GET: async () => {
        const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

        const report: Record<string, unknown> = {
          timestamp: new Date().toISOString(),
          env: {
            STRIPE_SECRET_KEY: mask(secretKey),
            STRIPE_WEBHOOK_SECRET: mask(webhookSecret),
          },
          secretKeyMode: classify(secretKey),
          webhookSecretMode: webhookSecret.includes("test") ? "test (heuristic)" : "live-or-unknown (whsec_ has no mode marker)",
        };

        // Live Stripe calls — prove the active mode.
        try {
          const stripe = getStripe();

          // No-arg retrieve returns the account tied to the active API key.
          const [account, balance] = await Promise.all([
            stripe.accounts.retrieve(undefined as unknown as string),
            stripe.balance.retrieve(),
          ]);

          report.accountRetrieve = {
            ok: true,
            id: account.id,
            country: account.country,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted,
          };
          report.balanceRetrieve = {
            ok: true,
            livemode: balance.livemode,
            available: balance.available,
            pending: balance.pending,
          };
          report.livemode = balance.livemode;
          report.stripeEnvironment = balance.livemode ? "LIVE" : "TEST";
        } catch (err) {
          const e = err as {
            type?: string;
            code?: string;
            message?: string;
            requestId?: string;
            statusCode?: number;
          };
          report.stripeCallError = {
            type: e?.type ?? null,
            code: e?.code ?? null,
            statusCode: e?.statusCode ?? null,
            requestId: e?.requestId ?? null,
            message: e?.message ?? String(err),
          };
          report.stripeEnvironment = "UNKNOWN (Stripe call failed)";
        }

        return new Response(JSON.stringify(report, null, 2), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
