import { getRequest } from "@tanstack/react-start/server";
import process from "node:process";

/**
 * Resolve the public origin used to build Stripe redirect (success/cancel/
 * onboarding) URLs WITHOUT trusting the attacker-controllable `Origin` request
 * header. An authenticated caller could otherwise inject
 * `Origin: https://attacker.com` and have Stripe redirect the victim there
 * after a real payment (open-redirect / phishing).
 *
 * Resolution order:
 *   1. An explicit server-configured public URL (`PUBLIC_URL` / `PUBLIC_APP_URL`).
 *   2. The server-set request URL origin (set by the runtime, not the caller).
 */
export function resolvePublicOrigin(): string {
  const configured = process.env.PUBLIC_URL ?? process.env.PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "";
  }
}
