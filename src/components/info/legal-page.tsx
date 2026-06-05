import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import pupxpressLogo from "@/assets/pupxpress-logo.png.asset.json";

/**
 * Self-contained, publicly reachable shell for legal documents (Privacy
 * Policy, Terms of Service). Unlike InfoPage this does not depend on auth and
 * links back to the landing page, so app-store reviewers can open the URLs
 * directly without signing in.
 */
export function LegalPage({
  title,
  effectiveDate,
  intro,
  children,
}: {
  title: string;
  effectiveDate: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header
        className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Link
            to="/"
            aria-label="Back to home"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <img src={pupxpressLogo.url} alt="PupXpress" className="h-7 w-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Effective date: {effectiveDate}
        </p>
        {intro ? (
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            {intro}
          </div>
        ) : null}

        <div className="mt-8 space-y-8">{children}</div>

        <footer className="mt-12 border-t pt-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Dogeride Technologies Inc</p>
          <p>1800 Wazee St, Ste 300</p>
          <p>Denver, CO 80202-2526, United States</p>
          <p className="mt-2">
            Questions?{" "}
            <a
              href="mailto:support@pupxpress.com"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              support@pupxpress.com
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}

/** A numbered/heading section block inside a legal document. */
export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/** Bulleted list styled to match the legal page typography. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
