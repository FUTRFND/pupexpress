import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Navigation } from "lucide-react";

import { useMode } from "@/hooks/use-mode";
import { listMyRides, type RideDTO } from "@/lib/rides.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/trips")({
  component: TripsPage,
});

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  accepted: "Accepted",
  driver_en_route: "Driver en route",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "completed") return "default";
  if (status === "cancelled") return "destructive";
  if (status === "requested") return "secondary";
  return "outline";
}

function TripsPage() {
  const { mode } = useMode();
  const listRidesFn = useServerFn(listMyRides);

  const ridesQuery = useQuery({
    queryKey: ["rides"],
    queryFn: () => listRidesFn(),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Trips</h1>

      {ridesQuery.isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading trips…
          </CardContent>
        </Card>
      ) : ridesQuery.isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            Couldn't load your trips. Pull to refresh or try again.
          </CardContent>
        </Card>
      ) : (ridesQuery.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {mode === "rider"
              ? "No rides yet. Book one from Home to get started."
              : "Trips you've driven and earnings will appear here."}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {(ridesQuery.data ?? []).map((ride) => (
            <RideCard key={ride.id} ride={ride} />
          ))}
        </div>
      )}
    </div>
  );
}

function RideCard({ ride }: { ride: RideDTO }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={statusVariant(ride.status)}>
            {STATUS_LABELS[ride.status] ?? ride.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(ride.created_at).toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-foreground">{ride.pickup_address}</span>
          </div>
          <div className="flex items-start gap-2">
            <Navigation className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="text-foreground">{ride.destination_address}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            Payment: {ride.payment_status}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Transfer: {ride.transfer_status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
