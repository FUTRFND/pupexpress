import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Car, Loader2 } from "lucide-react";

import { getNearbyDrivers } from "@/lib/presence.functions";
import type { SelectedPlace } from "@/lib/maps-loader";
import { cn } from "@/lib/utils";

function formatEta(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  return `~${mins} min away`;
}

/**
 * Shows the rider how many drivers are currently nearby their pickup and how
 * soon the closest one could arrive. Refreshes periodically while a pickup is
 * set. Individual driver locations are never exposed — only the aggregate.
 */
export function NearbyDrivers({ pickup }: { pickup: SelectedPlace | null }) {
  const nearbyFn = useServerFn(getNearbyDrivers);

  const query = useQuery({
    queryKey: ["nearby-drivers", pickup?.lat, pickup?.lng],
    queryFn: () =>
      nearbyFn({ data: { pickup: { lat: pickup!.lat, lng: pickup!.lng } } }),
    enabled: Boolean(pickup),
    refetchInterval: 20000,
    staleTime: 15000,
  });

  if (!pickup) return null;

  const data = query.data;
  const hasDrivers = (data?.count ?? 0) > 0;

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
        {query.isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Car className="size-4" />
        )}
      </span>
      <div className="min-w-0">
        {query.isLoading ? (
          <p className="text-muted-foreground">Looking for drivers nearby…</p>
        ) : hasDrivers ? (
          <p>
            <span className="font-medium">
              {data!.count} {data!.count === 1 ? "driver" : "drivers"} nearby
            </span>
            {data!.etaSeconds != null ? (
              <span className="text-muted-foreground">
                {" "}
                · {formatEta(data!.etaSeconds)}
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
