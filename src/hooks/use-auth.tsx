import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the initial session has been hydrated on the client. */
  loading: boolean;
  initializationError: string | null;
  retryInitialization: () => Promise<void>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const hydrateSession = async () => {
    setLoading(true);
    setInitializationError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setSession(data.session);
    } catch {
      setSession(null);
      setInitializationError("We couldn't verify your saved session. You can retry or sign in again.");
    } finally {
      setLoading(false);
    }
  };

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
      router.invalidate();
      queryClient.invalidateQueries();
    });

    void hydrateSession();

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
    };
  }, [router, queryClient]);

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
        retryInitialization: hydrateSession,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
