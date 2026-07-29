import { Capacitor } from "@capacitor/core";

import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export type OAuthProvider = "google" | "apple";

export const OAUTH_CALLBACK_URL = "com.pupxpress.app://auth/callback";
export const OAUTH_COMPLETE_EVENT = "pupx-oauth-complete";

const OAUTH_STATE_KEY = "pupx_oauth_state";
let nativeOAuthPending = false;
let callbackInProgress = false;

function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function notifyOAuthComplete(error?: string) {
  window.dispatchEvent(
    new CustomEvent(OAUTH_COMPLETE_EVENT, { detail: error ? { error } : {} }),
  );
}

async function finishNativeOAuth(rawUrl: string): Promise<void> {
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(rawUrl);
  } catch {
    return;
  }

  if (
    callbackUrl.protocol !== "com.pupxpress.app:" ||
    callbackUrl.hostname !== "auth" ||
    callbackUrl.pathname !== "/callback"
  ) {
    return;
  }

  callbackInProgress = true;
  const { Browser } = await import("@capacitor/browser");

  try {
    const params = new URLSearchParams(callbackUrl.search);
    const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));
    hashParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });

    const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    const returnedState = params.get("state");
    if (!expectedState || !returnedState || expectedState !== returnedState) {
      throw new Error("The sign-in response could not be verified. Please try again.");
    }

    const providerError = params.get("error_description") ?? params.get("error");
    if (providerError) throw new Error(providerError);

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) {
      throw new Error("The sign-in provider did not return a session.");
    }

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;

    notifyOAuthComplete();
  } catch (error) {
    notifyOAuthComplete(
      error instanceof Error ? error.message : "Sign in failed. Please try again.",
    );
  } finally {
    nativeOAuthPending = false;
    callbackInProgress = false;
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    await Browser.close().catch(() => {});
  }
}

/**
 * Install native deep-link and cancellation handlers once at app startup.
 * The callback is intentionally processed without logging its URL or tokens.
 */
export async function initializeOAuthCallbackHandling(): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};

  const [{ App }, { Browser }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/browser"),
  ]);

  const appUrlListener = await App.addListener("appUrlOpen", ({ url }) => {
    void finishNativeOAuth(url);
  });
  const browserListener = await Browser.addListener("browserFinished", () => {
    if (!nativeOAuthPending || callbackInProgress) return;
    nativeOAuthPending = false;
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    notifyOAuthComplete("Sign in was canceled.");
  });

  const launch = await App.getLaunchUrl();
  if (launch?.url) void finishNativeOAuth(launch.url);

  return () => {
    void appUrlListener.remove();
    void browserListener.remove();
  };
}

/**
 * Starts OAuth in SFSafariViewController on iOS. Web continues to use the
 * existing Lovable/Supabase broker flow.
 */
export async function signInWithProvider(
  provider: OAuthProvider,
): Promise<{ pending: boolean }> {
  if (!Capacitor.isNativePlatform()) {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) throw result.error;
    return { pending: Boolean(result.redirected) };
  }

  const { Browser } = await import("@capacitor/browser");
  const state = randomState();
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  nativeOAuthPending = true;

  const params = new URLSearchParams({
    provider,
    redirect_uri: OAUTH_CALLBACK_URL,
    state,
  });
  const brokerUrl = new URL("/~oauth/initiate", window.location.origin);
  brokerUrl.search = params.toString();

  try {
    await Browser.open({
      url: brokerUrl.toString(),
      presentationStyle: "popover",
    });
    return { pending: true };
  } catch (error) {
    nativeOAuthPending = false;
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    throw error;
  }
}
