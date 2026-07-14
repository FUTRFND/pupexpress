import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — PupXpress" },
      {
        name: "description",
        content: "Choose a new password for your PupXpress account.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

const MIN_PASSWORD = 6;

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase parses the recovery tokens from the URL hash automatically and
  // fires PASSWORD_RECOVERY with a temporary session. We wait for either that
  // event or an existing session before letting the user submit.
  useEffect(() => {
    let resolved = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && !resolved)) {
        resolved = true;
        setReady("ok");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (resolved) return;
      if (data.session) {
        resolved = true;
        setReady("ok");
      } else {
        // Give the client a beat to process the hash fragment.
        setTimeout(() => {
          if (!resolved) setReady("invalid");
        }, 1200);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD) {
      toast.error(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      toast.error(error.message || "Couldn't update your password.");
      return;
    }
    // Sign the recovery session out so the user signs in fresh with the
    // new password.
    await supabase.auth.signOut();
    setBusy(false);
    setDone(true);
    toast.success("Password updated. Please sign in.");
    setTimeout(() => navigate({ to: "/", replace: true }), 1400);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Set a new password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a strong password you haven't used before.
          </p>
        </div>

        {ready === "checking" && (
          <p className="text-sm text-muted-foreground">Verifying reset link…</p>
        )}

        {ready === "invalid" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              This password reset link is invalid or has expired. Request a new
              one to continue.
            </div>
            <Link
              to="/forgot-password"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Request a new link
            </Link>
            <Link
              to="/"
              className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        )}

        {ready === "ok" && !done && (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
              />
              {confirm.length > 0 && confirm !== password && (
                <p className="text-xs text-destructive">
                  Passwords do not match.
                </p>
              )}
            </div>
            <Button type="submit" className="h-11" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}

        {done && (
          <div className="rounded-xl border bg-muted/40 p-4 text-sm">
            Your password has been updated. Redirecting to sign in…
          </div>
        )}
      </div>
    </div>
  );
}
