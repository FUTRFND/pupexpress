import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { AppTabBar } from "@/components/app-tab-bar";
import { usePushNotifications } from "@/hooks/use-push-notifications";

/**
 * The ONE and ONLY auth-to-view guard.
 *
 * - `ssr: false` keeps this subtree client-rendered, so the gate reads the
 *   localStorage-backed session and never fights SSR (no redirect loops on
 *   hard refresh).
 * - `getUser()` re-validates the session with the Auth server before any
 *   protected page renders.
 * - Unauthenticated users are sent to the welcome/auth screen at "/".
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
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
