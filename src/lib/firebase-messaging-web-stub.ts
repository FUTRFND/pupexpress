/**
 * Stub for `firebase/messaging`.
 *
 * `@capacitor-firebase/messaging` statically imports `firebase/messaging` in its
 * WEB implementation only. PupXpress uses this plugin exclusively on native
 * (iOS / Android) — web push is handled separately — so the full Firebase JS
 * SDK is never needed. This stub satisfies the bundler without pulling in the
 * heavy dependency. None of these are ever called on native.
 */
export function getMessaging(): unknown {
  throw new Error("firebase/messaging web is not supported in this app");
}
export async function getToken(): Promise<string> {
  throw new Error("firebase/messaging web is not supported in this app");
}
export async function deleteToken(): Promise<boolean> {
  return false;
}
export function onMessage(): () => void {
  return () => {};
}
export async function isSupported(): Promise<boolean> {
  return false;
}
