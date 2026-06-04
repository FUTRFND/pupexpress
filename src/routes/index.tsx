import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OnboardingTour } from "@/components/onboarding-tour";
import pupxpressLogo from "@/assets/pupxpress-logo.png.asset.json";
import pupxpressHero from "@/assets/pupxpress-hero.png.asset.json";

const TOUR_DONE_KEY = "pupx_tour_done";

export const Route = createFileRoute("/")({
  // Body depends on client-only auth state (localStorage session); skip SSR for
  // this route so the welcome/auth screen never produces a hydration mismatch.
  ssr: false,
  head: () => ({
    meta: [
      { title: "PupXpress — Rides for your dog" },
      {
        name: "description",
        content:
          "PupXpress (Dogeride) — book trusted rides for your dog, or drive and earn. Sign in to get started.",
      },
      { property: "og:title", content: "PupXpress — Rides for your dog" },
      {
        property: "og:description",
        content: "Book trusted rides for your dog, or drive and earn.",
      },
    ],
  }),
  component: WelcomePage,
});

function Splash() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <img
        src={pupxpressHero.url}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />
      <div
        className="relative flex flex-col items-center"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 3.5rem)" }}
      >
        <img
          src={pupxpressLogo.url}
          alt="PupXpress"
          className="h-24 w-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
        />
      </div>
      <div className="relative mt-auto flex flex-col items-center gap-3 pb-16">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    </div>
  );
}

function WelcomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"splash" | "tour" | "auth">("splash");
  // Hold the splash on screen briefly so the brand moment is visible.
  const [splashElapsed, setSplashElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashElapsed(true), 1900);
    return () => clearTimeout(t);
  }, []);

  // Once auth has resolved and the splash has shown, decide where to go.
  useEffect(() => {
    if (loading || !splashElapsed) return;
    if (user) {
      navigate({ to: "/home", replace: true });
      return;
    }
    const seen =
      typeof window !== "undefined" &&
      localStorage.getItem(TOUR_DONE_KEY) === "1";
    setPhase(seen ? "auth" : "tour");
  }, [loading, splashElapsed, user, navigate]);

  if (loading || !splashElapsed || phase === "splash" || user) {
    return <Splash />;
  }

  if (phase === "tour") {
    return (
      <OnboardingTour
        onDone={() => {
          if (typeof window !== "undefined") {
            localStorage.setItem(TOUR_DONE_KEY, "1");
          }
          setPhase("auth");
        }}
      />
    );
  }

  return <AuthScreen />;
}

function AuthScreen() {
  const [busy, setBusy] = useState(false);

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    // On redirect the browser navigates away; on token flow the auth
    // listener picks up the session and routes us into the app.
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="relative flex flex-1 flex-col items-center overflow-hidden px-6 text-center"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 3rem)" }}
      >
        <img
          src={pupxpressHero.url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <img
          src={pupxpressLogo.url}
          alt="PupXpress"
          className="relative h-20 w-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
        />
      </header>

      <main className="relative z-10 -mt-8 flex flex-col gap-5 rounded-t-3xl bg-background px-6 py-8 shadow-[var(--shadow-elegant)]">
        <Button
          variant="outline"
          className="h-12 w-full text-base"
          onClick={handleGoogle}
          disabled={busy}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or use email
          <span className="h-px flex-1 bg-border" />
        </div>

        <EmailAuth busy={busy} setBusy={setBusy} />
      </main>
    </div>
          variant="outline"
          className="h-12 w-full text-base"
          onClick={handleGoogle}
          disabled={busy}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or use email
          <span className="h-px flex-1 bg-border" />
        </div>

        <EmailAuth busy={busy} setBusy={setBusy} />
      </main>
    </div>
  );
}

function EmailAuth({
  busy,
  setBusy,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your email to confirm your account.");
  };

  return (
    <Tabs defaultValue="signin" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="signin">Sign in</TabsTrigger>
        <TabsTrigger value="signup">Sign up</TabsTrigger>
      </TabsList>

      <TabsContent value="signin">
        <form className="mt-4 flex flex-col gap-3" onSubmit={handleSignIn}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signin-email">Email</Label>
            <Input
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signin-password">Password</Label>
            <Input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            Sign in
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="signup">
        <form className="mt-4 flex flex-col gap-3" onSubmit={handleSignUp}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-name">Full name</Label>
            <Input
              id="signup-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>
            Create account
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
