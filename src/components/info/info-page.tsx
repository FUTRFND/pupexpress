import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type IconType = ComponentType<{ className?: string }>;

/** Page shell with a back button to the profile hub and an optional intro. */
export function InfoPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="-ml-2 rounded-full"
        >
          <Link to="/profile" aria-label="Back to profile">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      {description ? (
        <p className="text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

/** A highlighted callout banner (e.g. the pricing value badge). */
export function InfoBanner({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl bg-primary px-5 py-4 text-center text-primary-foreground">
      <p className="text-xl font-extrabold">{title}</p>
      {subtitle ? (
        <p className="mt-1 text-sm opacity-90">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** Card with a title, optional icon, and a bulleted list of plain strings. */
export function BulletCard({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: ReactNode[];
  icon?: IconType;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Card listing a label/value pair table, used for fare breakdowns. */
export function RowsCard({
  title,
  description,
  rows,
}: {
  title?: string;
  description?: string;
  rows: { label: string; value: string; emphasis?: boolean }[];
}) {
  return (
    <Card>
      {title ? (
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className="space-y-3">
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={i}
              className={
                row.emphasis
                  ? "flex items-center justify-between border-t pt-2 text-base font-bold"
                  : "flex items-center justify-between text-sm"
              }
            >
              <span
                className={
                  row.emphasis ? "text-foreground" : "text-muted-foreground"
                }
              >
                {row.label}
              </span>
              <span
                className={
                  row.emphasis ? "text-primary" : "font-medium text-foreground"
                }
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
