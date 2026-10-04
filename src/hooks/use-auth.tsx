import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import {
  clearPersistedSession,
  readPersistedSession,
  supabase,
} from "@/integrations/supabase/client";
import { markStartup } from "@/lib/startup-performance";

const SESSION_VALIDATION_BUDGET_MS = 3_000;

type AuthBootState =
  | "local-session-found"
  | "local-session-missing"
  | "remote-validation"
  | "authenticated"
  | "signed-out"
  | "recoverable-error";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the initial session has been hydrated on the client. */
  loading: boolean;
  initializationError: string | null;
  bootState: AuthBootState;
  retryInitialization: () => Promise<void>;
  signInAgain: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Single, centralized auth source of truth.
 *
 * - Hydrates the persisted session once on mount (localStorage-backed,
 *   so it survives refresh / app reopen).
 * - Wires the ONLY `onAuthStateChange` listener in the app and invalidates
 *   router + query caches on every auth transition.
 *
 * The route-level gate in `_authenticated/route.tsx` is the only redirect
 * guard. This provider only exposes state to the UI — it never redirects.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialSession] = useState(() => {
    markStartup("T5_LOCAL_SESSION_START");
    const stored = readPersistedSession();
    markStartup("T6_LOCAL_SESSION_COMPLETE", stored ? "session found" : "no session");
    return stored;
  });
  const [session, setSession] = useState<Session | null>(initialSession);
  // Local restoration is synchronous. Remote validation must never block UI.
  const [loading, setLoading] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [bootState, setBootState] = useState<AuthBootState>(
    initialSession ? "local-session-found" : "local-session-missing",
  );
  const router = useRouter();
  const queryClient = useQueryClient();

  const signInAgain = useCallback(async () => {
    clearPersistedSession();
    setSession(null);
    setInitializationError(null);
    setBootState("signed-out");
    setLoading(false);
    void Promise.race([
      supabase.auth.signOut({ scope: "local" }),
      new Promise((resolve) => setTimeout(resolve, 1_000)),
    ]).catch(() => {});
    await router.invalidate();
    queryClient.clear();
  }, [queryClient, router]);

  const hydrateSession = useCallback(async () => {
    setInitializationError(null);
    setBootState("remote-validation");
    markStartup("T7_REMOTE_VALIDATION_START");
    try {
      const result = await Promise.race([
        supabase.auth.getSession().then((value) => ({ kind: "result" as const, value })),
        new Promise<{ kind: "timeout" }>((resolve) =>
          setTimeout(() => resolve({ kind: "timeout" }), SESSION_VALIDATION_BUDGET_MS),
        ),
      ]);
      if (result.kind === "timeout") {
        setBootState("recoverable-error");
        setInitializationError(
          "Session verification is taking longer than expected. You can retry or sign in again.",
        );
        markStartup("T8_REMOTE_VALIDATION_COMPLETE", "timed out; UI remained available");
        return;
      }
      const { data, error } = result.value;
      if (error) throw error;
      setSession(data.session);
      setBootState(data.session ? "authenticated" : "signed-out");
      markStartup("T8_REMOTE_VALIDATION_COMPLETE", data.session ? "authenticated" : "signed out");
    } catch (error) {
      // A temporary network failure must not destroy a locally-restored session.
      const message = error instanceof Error ? error.message : "Session verification failed.";
      const definitelyInvalid =
        /invalid refresh token|refresh token.*not found|session.*missing|jwt.*expired/i.test(
          message,
        );
      if (definitelyInvalid) {
        clearPersistedSession();
        setSession(null);
        setBootState("signed-out");
        setInitializationError("Your session expired. Please sign in again.");
      } else {
        setBootState("recoverable-error");
        setInitializationError(
          navigator.onLine
            ? "We couldn't refresh your session. You can retry or sign in again."
            : "You're offline. Reconnect to refresh your session, or sign in again.",
        );
      }
      markStartup(
        "T8_REMOTE_VALIDATION_COMPLETE",
        definitelyInvalid ? "invalid session" : "network error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let removeOAuthHandlers: (() => void) | undefined;

    // Listener first so we never miss an event during hydration.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setInitializationError(null);
      setLoading(false);
      setBootState(nextSession ? "authenticated" : "signed-out");
      router.invalidate();
      queryClient.invalidateQueries();
    });

    void hydrateSession();

    const retryWhenOnline = () => void hydrateSession();
    const retryWhenVisible = () => {
      if (document.visibilityState === "visible") void hydrateSession();
    };
    window.addEventListener("online", retryWhenOnline);
    document.addEventListener("visibilitychange", retryWhenVisible);

    void import("@/lib/oauth")
      .then(({ initializeOAuthCallbackHandling }) => initializeOAuthCallbackHandling())
      .then((remove) => {
        if (mounted) removeOAuthHandlers = remove;
        else remove();
      })
      .catch(() => {
        if (!mounted) return;
        setInitializationError("Native sign-in could not be initialized. Please retry.");
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      removeOAuthHandlers?.();
      window.removeEventListener("online", retryWhenOnline);
      document.removeEventListener("visibilitychange", retryWhenVisible);
    };
  }, [hydrateSession, router, queryClient]);

  const signOut = async () => {
    // Remove the device's push token before dropping the session so a
    // signed-out device stops receiving notifications (native only; no-op web).
    const { disableNativePush } = await import("@/lib/native-push");
    await disableNativePush();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        initializationError,
        bootState,
        retryInitialization: hydrateSession,
        signInAgain,
        signOut,
      }}
    >
      {children}
      {initializationError && session ? (
        <div
          role="status"
          className="fixed inset-x-3 bottom-24 z-[100] mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 shadow-lg"
        >
          <p>{initializationError}</p>
          <div className="mt-2 flex gap-4 font-semibold">
            <button type="button" className="underline" onClick={() => void hydrateSession()}>
              Retry
            </button>
            <button type="button" className="underline" onClick={() => void signInAgain()}>
              Sign in again
            </button>
          </div>
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
