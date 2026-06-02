import Stripe from "stripe";
import process from "node:process";

/**
 * Server-only Stripe helpers. The `.server.ts` suffix keeps this file (and the
 * secret key it reads) out of every client bundle.
 *
 * SECURITY: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are read here only,
 * inside functions that run on the server at request time. They are never
 * imported into, or referenced from, browser code.
 *
 * Runtime note: the app runs on a Cloudflare-Workers-style runtime, so we use
 * Stripe's fetch HTTP client and the SubtleCrypto provider for webhook
 * signature verification (Node's crypto-based defaults are not available).
 */

let cachedStripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Stripe is not configured. Set the STRIPE_SECRET_KEY secret to enable payments.",
    );
  }
  if (!cachedStripe) {
    cachedStripe = new Stripe(key, {
      apiVersion: "2026-05-27.dahlia",
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return cachedStripe;
}

/** SubtleCrypto provider for Worker-runtime webhook signature verification. */
export function getStripeCryptoProvider() {
  return Stripe.createSubtleCryptoProvider();
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "Stripe webhook secret missing. Set the STRIPE_WEBHOOK_SECRET secret.",
    );
  }
  return secret;
}

// ---------------------------------------------------------------------------
// Configurable platform fee model
// ---------------------------------------------------------------------------
// All values are configurable via env so the commercial terms are NOT
// hardcoded throughout the app. The defaults below are placeholders only —
// final percentage / minimum / flat fee are confirmed before go-live.
//
//   PLATFORM_FEE_PERCENT  fraction of ride total kept by the platform (0.18 = 18%)
//   PLATFORM_FEE_MIN      minimum platform fee floor (currency units, e.g. 2.00)
//   PLATFORM_FEE_FLAT     optional fixed fee added on top (currency units)
//   RIDE_BASE_FARE        fare used when a ride has no computed total yet
//   PLATFORM_CURRENCY     ISO currency (lowercase), defaults to "usd"

export interface FeeConfig {
  percent: number;
  minFee: number;
  flatFee: number;
  baseFare: number;
  currency: string;
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getFeeConfig(): FeeConfig {
  return {
    percent: numEnv("PLATFORM_FEE_PERCENT", 0.18),
    minFee: numEnv("PLATFORM_FEE_MIN", 2),
    flatFee: numEnv("PLATFORM_FEE_FLAT", 0),
    baseFare: numEnv("RIDE_BASE_FARE", 20),
    currency: (process.env.PLATFORM_CURRENCY ?? "usd").toLowerCase(),
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface FeeBreakdown {
  rideTotal: number;
  platformFee: number;
  driverEarnings: number;
  currency: string;
}

/**
 * Compute the platform fee and driver earnings for a ride total.
 * platformFee = max(rideTotal * percent + flatFee, minFee), capped at rideTotal.
 */
export function computeFees(rideTotalInput?: number | null): FeeBreakdown {
  const cfg = getFeeConfig();
  const rideTotal = round2(
    rideTotalInput && rideTotalInput > 0 ? rideTotalInput : cfg.baseFare,
  );

  let platformFee = rideTotal * cfg.percent + cfg.flatFee;
  if (platformFee < cfg.minFee) platformFee = cfg.minFee;
  platformFee = round2(Math.min(platformFee, rideTotal));

  const driverEarnings = round2(rideTotal - platformFee);

  return { rideTotal, platformFee, driverEarnings, currency: cfg.currency };
}

/** Convert a currency-unit amount (e.g. 20.50) to the smallest unit (cents). */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
