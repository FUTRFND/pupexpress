import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/use-auth";
import { ModeProvider } from "@/hooks/use-mode";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "PupXpress — Rides for your dog" },
      {
        name: "description",
        content:
          "PupXpress — book trusted rides for your dog, or drive and earn. Safe, on-demand pet transport.",
      },
      { name: "author", content: "PupXpress" },
      { name: "theme-color", content: "#f97316" },
      { property: "og:title", content: "PupXpress — Rides for your dog" },
      {
        property: "og:description",
        content: "Book trusted rides for your dog, or drive and earn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "PupXpress — Rides for your dog" },
      { name: "description", content: "PupPals Ride is a mobile app for pet transportation ride-sharing." },
      { property: "og:description", content: "PupPals Ride is a mobile app for pet transportation ride-sharing." },
      { name: "twitter:description", content: "PupPals Ride is a mobile app for pet transportation ride-sharing." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/dc957415-22a1-4177-b290-83822606ff4b/id-preview-fe36a921--4aeee279-3ae2-4066-8a90-54530c6925d4.lovable.app-1780696512461.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/dc957415-22a1-4177-b290-83822606ff4b/id-preview-fe36a921--4aeee279-3ae2-4066-8a90-54530c6925d4.lovable.app-1780696512461.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/**
 * Mobile-safe startup watchdog.
 *
 * Runs in the document before React hydrates. If the app has not signalled
 * readiness within a timeout (silent JS crash, blocked URL, or a dead network
 * inside the iOS WebView), it replaces the blank white screen with a visible
 * "couldn't connect" message and a Retry button instead of leaving the user
 * staring at nothing. React sets `window.__APP_READY__ = true` once it mounts,
 * which cancels the watchdog.
 */
const BOOT_WATCHDOG = `
(function () {
  if (window.__pupxBoot) return;
  window.__pupxBoot = true;
  var TIMEOUT = 12000;
  function showError() {
    if (window.__APP_READY__ || document.getElementById('pupx-boot-error')) return;
    var el = document.createElement('div');
    el.id = 'pupx-boot-error';
    el.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;background:#fff;color:#1c1917;font-family:-apple-system,system-ui,Inter,sans-serif;');
    el.innerHTML =
      '<div style="font-size:40px">🐾</div>' +
      '<div style="font-size:18px;font-weight:600">Couldn\\'t connect</div>' +
      '<div style="font-size:14px;color:#78716c;max-width:280px">PupXpress couldn\\'t reach the network. Check your connection and try again.</div>' +
      '<button id="pupx-boot-retry" style="margin-top:8px;padding:12px 24px;border:0;border-radius:12px;background:#f97316;color:#fff;font-size:16px;font-weight:600">Retry</button>';
    document.body.appendChild(el);
    var btn = document.getElementById('pupx-boot-retry');
    if (btn) btn.addEventListener('click', function () { window.location.reload(); });
  }
  setTimeout(showError, TIMEOUT);
  window.addEventListener('error', function (e) {
    if (e && e.message && /ChunkLoadError|Loading chunk|dynamically imported module/i.test(String(e.message))) {
      setTimeout(showError, 1500);
    }
  });
})();
`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
        <script dangerouslySetInnerHTML={{ __html: BOOT_WATCHDOG }} />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Signal a successful boot so the startup watchdog stands down and any
    // fallback error screen it may have shown is cleared.
    if (typeof window !== "undefined") {
      (window as unknown as { __APP_READY__?: boolean }).__APP_READY__ = true;
      const fallback = document.getElementById("pupx-boot-error");
      if (fallback) fallback.remove();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ModeProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster />
        </ModeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
