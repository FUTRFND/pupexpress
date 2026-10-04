import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { readPersistedSession } from "@/integrations/supabase/client";
import { markInteractive, markStartup } from "@/lib/startup-performance";
import { AppHeader } from "@/components/app-header";
import { AppTabBar } from "@/components/app-tab-bar";
import { usePushNotifications } from "@/hooks/use-push-notifications";

/**
 * The ONE and ONLY auth-to-view guard.
 *
 * - `ssr: false` keeps this subtree client-rendered, so the gate reads the
 *   localStorage-backed session and never fights SSR (no redirect loops on
 *   hard refresh).
 * - Reads the already-persisted local session synchronously. Remote refresh is
 *   performed in the background by AuthProvider and never blocks rendering.
 * - Unauthenticated users are sent to the welcome/auth screen at "/".
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: () => {
    const session = readPersistedSession();
    markStartup("T9_ROUTE_DECISION", session ? "authenticated route" : "sign-in route");
    if (!session?.user) {
      throw redirect({ to: "/" });
    }
    return { user: session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  // Registers native push tokens (no-op in the browser / preview).
  usePushNotifications(true);

  useEffect(() => {
    markStartup("T10_FIRST_SCREEN", "authenticated shell");
    markInteractive("authenticated shell");
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <main
        className="mx-auto w-full max-w-screen-sm flex-1 px-4 pb-24 pt-4"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >
        <Outlet />
      </main>
      <AppTabBar />
    </div>
  );
}
