import { Car, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

function formatEta(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  return `~${mins} min away`;
}

/**
 * Shows the rider how many drivers are currently nearby and how soon the
 * closest one could arrive. Driven by the shared nearby-drivers query lifted
 * into the booking screen (so the map and this banner stay in sync). Individual
 * driver identities are never exposed — only the aggregate count + ETA.
 */
export function NearbyDrivers({
  visible,
  loading,
  count,
  etaSeconds,
}: {
  visible: boolean;
  loading: boolean;
  count: number;
  etaSeconds: number | null;
}) {
  if (!visible) return null;

  const hasDrivers = count > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
        hasDrivers
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-muted/40",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          hasDrivers ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Car className="size-4" />
        )}
      </span>
      <div className="min-w-0">
        {loading ? (
          <p className="text-muted-foreground">Looking for drivers nearby…</p>
        ) : hasDrivers ? (
          <p>
            <span className="font-medium">
              {count} {count === 1 ? "driver" : "drivers"} nearby
            </span>
            {etaSeconds != null ? (
              <span className="text-muted-foreground">
                {" "}
                · {formatEta(etaSeconds)}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-muted-foreground">
            No drivers nearby right now — you can still request and we'll keep
            looking.
          </p>
        )}
      </div>
    </div>
  );
}
