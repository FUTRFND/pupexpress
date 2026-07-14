import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password — PupXpress" },
      {
        name: "description",
        content: "Recover access to your PupXpress account.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    // Never disclose whether the account exists. Show the generic message
    // even on error (unless it's a rate limit, which is safe to surface).
    if (error && /rate|limit|too many/i.test(error.message)) {
      toast.error("Too many attempts. Please wait a moment and try again.");
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Reset your password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the email associated with your account and we'll send you a
            password reset link.
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              If an account exists for <strong>{email.trim()}</strong>, a
              password reset link has been sent. Check your inbox (and spam
              folder).
            </div>
            <Button
              className="h-11"
              onClick={() => navigate({ to: "/", replace: true })}
            >
              Back to sign in
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setSent(false)}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            <Button type="submit" className="h-11" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
