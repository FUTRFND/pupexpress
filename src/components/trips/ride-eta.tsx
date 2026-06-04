import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clock, MapPin, Navigation } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getRideEta, type RideEtaDTO } from "@/lib/eta.functions";

interface RideEtaProps {
  rideId: string;
  /** Driver-arrived state shows a dedicated "arrived" message instead. */
  arrived?: boolean;
}

function formatEta(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  if (miles < 0.1) return "nearby";
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

/**
 * Live ETA banner for an active ride. Computes a traffic-aware estimate from
 * the driver's latest location to the pickup (or destination once underway) and
 * refreshes it as the driver moves — throttled so we don't hammer the Routes
 * API on every location tick.
 */
export function RideEta({ rideId, arrived }: RideEtaProps) {
  const etaFn = useServerFn(getRideEta);
  const [eta, setEta] = useState<RideEtaDTO | null>(null);
  const lastComputedAt = useRef(0);
  const MIN_INTERVAL_MS = 15000;

  const compute = useCallback(
    (force = false) => {
      const now = Date.now();
      if (!force && now - lastComputedAt.current < MIN_INTERVAL_MS) return;
      lastComputedAt.current = now;
      etaFn({ data: { rideId } })
        .then((result) => setEta(result))
        .catch(() => {
          /* non-fatal — keep the previous estimate */
        });
    },
    [etaFn, rideId],
  );

  useEffect(() => {
    compute(true);
    const channel = supabase
      .channel(`ride-eta-${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ride_locations",
          filter: `ride_id=eq.${rideId}`,
        },
        () => compute(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId, compute]);

  if (arrived) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-primary/5 px-4 py-3">
        <MapPin className="size-5 shrink-0 text-primary" />
        <p className="text-sm font-medium text-foreground">
          Your driver has arrived at the pickup.
        </p>
      </div>
    );
  }

  if (!eta) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          {eta.target === "destination" ? (
            <Navigation className="size-4" />
          ) : (
            <Clock className="size-4" />
          )}
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">
            {formatEta(eta.durationSeconds)} away
          </p>
          <p className="text-xs text-muted-foreground">
            {eta.target === "destination"
              ? "Estimated time to destination"
              : "Driver is on the way to pickup"}
          </p>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {formatDistance(eta.distanceMeters)}
      </span>
    </div>
  );
}
