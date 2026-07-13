import { registerDeviceToken, unregisterDeviceToken } from "@/lib/push.functions";

/**
 * Native (iOS / Android) push token management via Firebase Cloud Messaging.
 *
 * IMPORTANT: On iOS, `@capacitor/push-notifications` only surfaces the raw APNs
 * device token, which Firebase Admin (FCM HTTP v1 `messages:send`) cannot
 * deliver to. We use `@capacitor-firebase/messaging` instead, whose
 * `getToken()` / `tokenReceived` return a real FCM registration token on BOTH
 * iOS and Android — the exact token type our server (`push.server.ts`) sends
 * to. Requires `GoogleService-Info.plist` in the iOS App target and the
 * Firebase iOS SDK (installed by `npx cap sync ios`).
 *
 * All Capacitor imports are dynamic so the web/SSR bundle never evaluates
 * native code paths.
 */

let lastToken: string | null = null;

function shortId(token: string): string {
  // Never log full tokens — only a truncated, non-reversible-ish preview.
  return token.length > 12 ? `${token.slice(0, 6)}…${token.slice(-4)}` : "short";
}

async function isNative(): Promise<boolean> {
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor.isNativePlatform();
}

async function currentPlatform(): Promise<"ios" | "android"> {
  const { Capacitor } = await import("@capacitor/core");
  return Capacitor.getPlatform() === "ios" ? "ios" : "android";
}

async function saveToken(token: string): Promise<void> {
  if (!token || token === lastToken) return;
  const platform = await currentPlatform();
  await registerDeviceToken({ data: { token, platform } });
  lastToken = token;
  if (import.meta.env.DEV) {
    console.debug(`[push] token saved (${platform}) ${shortId(token)}`);
  }
}

/**
 * Request permission, fetch the FCM token, persist it, and subscribe to token
 * refreshes. Safe to call on web (no-op). Returns the FCM token or null.
 */
export async function enableNativePush(): Promise<string | null> {
  try {
    if (!(await isNative())) return null;

    const { FirebaseMessaging } = await import(
      "@capacitor-firebase/messaging"
    );

    let { receive } = await FirebaseMessaging.checkPermissions();
    if (receive === "prompt" || receive === "prompt-with-rationale") {
      receive = (await FirebaseMessaging.requestPermissions()).receive;
    }
    if (receive !== "granted") return null;

    // Token refresh events (e.g. app reinstall, restore, key rotation).
    await FirebaseMessaging.removeAllListeners();
    await FirebaseMessaging.addListener("tokenReceived", ({ token }) => {
      if (token) saveToken(token).catch(() => {});
    });

    const { token } = await FirebaseMessaging.getToken();
    if (token) await saveToken(token);
    return token ?? null;
  } catch (err) {
    // Best-effort: surface a message without leaking token/credential details.
    console.error("[push] enable failed:", (err as Error)?.message ?? err);
    return null;
  }
}

/**
 * Remove the device token on sign-out: delete the FCM token natively and drop
 * the row from `device_tokens` so a signed-out device stops receiving pushes.
 */
export async function disableNativePush(): Promise<void> {
  try {
    if (!(await isNative())) return;

    const { FirebaseMessaging } = await import(
      "@capacitor-firebase/messaging"
    );

    const token = lastToken ?? (await FirebaseMessaging.getToken()).token;
    await FirebaseMessaging.removeAllListeners().catch(() => {});
    await FirebaseMessaging.deleteToken().catch(() => {});
    if (token) {
      await unregisterDeviceToken({ data: { token } }).catch(() => {});
    }
    lastToken = null;
  } catch (err) {
    console.error("[push] disable failed:", (err as Error)?.message ?? err);
  }
}
