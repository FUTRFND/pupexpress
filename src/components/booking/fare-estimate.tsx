import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Loader2, MapPin, Wallet } from "lucide-react";

import { estimateFare, type FareEstimateDTO } from "@/lib/fare.functions";
import { formatCurrency } from "@/lib/format";
import type { SelectedPlace } from "@/lib/maps-loader";

interface FareEstimateProps {
  pickup: SelectedPlace | null;
  destination: SelectedPlace | null;
  onQuote: (quote: FareEstimateDTO | null) => void;
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  return `${km.toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function FareEstimate({ pickup, destination, onQuote }: FareEstimateProps) {
  const estimateFn = useServerFn(estimateFare);
  const enabled = Boolean(pickup && destination);

  const query = useQuery({
    queryKey: [
      "fare-estimate",
      pickup?.lat,
      pickup?.lng,
      destination?.lat,
      destination?.lng,
    ],
    enabled,
    staleTime: 60_000,
    queryFn: () =>
      estimateFn({
        data: {
          pickup: { lat: pickup!.lat, lng: pickup!.lng },
          destination: { lat: destination!.lat, lng: destination!.lng },
        },
      }),
  });

  useEffect(() => {
    onQuote(query.data ?? null);
  }, [query.data, onQuote]);

  if (!enabled) return null;

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Estimating fare…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Couldn't estimate the fare for this trip. You can still request the ride.
      </div>
    );
  }

  const quote = query.data;

  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="size-4 text-primary" /> Estimated fare
        </div>
        <span className="text-lg font-bold tracking-tight">
          {formatCurrency(quote.rideTotal, quote.currency)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="size-3.5" /> {formatDistance(quote.distanceMeters)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" /> {formatDuration(quote.durationSeconds)}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Final price is confirmed after the ride.
      </p>
    </div>
  );
}
