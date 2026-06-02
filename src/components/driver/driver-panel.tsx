import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2,
  MapPin,
  Navigation,
  Power,
  Car,
  CheckCircle2,
  Route as RouteIcon,
} from "lucide-react";

import {
  ensureDriverRole,
  listAvailableRides,
  listMyDriverRides,
  acceptRide,
  advanceRide,
} from "@/lib/driver.functions";
import type { RideDTO } from "@/lib/rides.functions";
import { isActiveRide, rideStatusLabel } from "@/lib/ride-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const POLL_MS = 5000;

export function DriverPanel() {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(false);

  const ensureRoleFn = useServerFn(ensureDriverRole);
  const availableFn = useServerFn(listAvailableRides);
  const assignedFn = useServerFn(listMyDriverRides);
  const acceptFn = useServerFn(acceptRide);
  const advanceFn = useServerFn(advanceRide);

  // Upgrade to a driver-capable role once when the panel mounts.
  const roleQuery = useQuery({
    queryKey: ["driver-role"],
    queryFn: () => ensureRoleFn(),
    staleTime: Infinity,
  });

  const assignedQuery = useQuery({
    queryKey: ["driver-assigned"],
    queryFn: () => assignedFn(),
    enabled: roleQuery.isSuccess,
    refetchInterval: online ? POLL_MS : false,
  });

  const activeRide = (assignedQuery.data ?? []).find((r) =>
    isActiveRide(r.status),
  );

  const availableQuery = useQuery({
    queryKey: ["available-rides"],
    queryFn: () => availableFn(),
    enabled: roleQuery.isSuccess && online && !activeRide,
    refetchInterval: online && !activeRide ? POLL_MS : false,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["driver-assigned"] });
    queryClient.invalidateQueries({ queryKey: ["available-rides"] });
    queryClient.invalidateQueries({ queryKey: ["rides"] });
  };

  const acceptMutation = useMutation({
    mutationFn: (rideId: string) => acceptFn({ data: { rideId } }),
    onSuccess: () => {
      toast.success("Ride accepted — you're assigned.");
      invalidateAll();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't accept ride"),
  });

  const advanceMutation = useMutation({
    mutationFn: (vars: {
      rideId: string;
      action: "en_route" | "start" | "complete" | "cancel";
    }) => advanceFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.action === "complete"
          ? "Ride completed."
          : vars.action === "cancel"
            ? "Ride cancelled."
            : "Ride updated.",
      );
      invalidateAll();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't update ride"),
  });

  // Keep available list fresh the moment a driver goes online.
  useEffect(() => {
    if (online && !activeRide) availableQuery.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  if (roleQuery.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Setting up driver mode…
        </CardContent>
      </Card>
    );
  }

  if (roleQuery.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          Couldn't enable driver mode. Please try again.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex size-9 items-center justify-center rounded-full ${
                online
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Power className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">
                {online ? "You're online" : "You're offline"}
              </p>
              <p className="text-xs text-muted-foreground">
                {online
                  ? "Receiving new ride requests"
                  : "Go online to see ride requests"}
              </p>
            </div>
          </div>
          <Button
            variant={online ? "secondary" : "default"}
            className="h-10"
            onClick={() => setOnline((v) => !v)}
          >
            {online ? "Go offline" : "Go online"}
          </Button>
        </CardContent>
      </Card>

      {activeRide ? (
        <ActiveRideCard
          ride={activeRide}
          onAdvance={(action) =>
            advanceMutation.mutate({ rideId: activeRide.id, action })
          }
          pending={advanceMutation.isPending}
        />
      ) : online ? (
        <AvailableRides
          query={availableQuery}
          onAccept={(id) => acceptMutation.mutate(id)}
          acceptingId={
            acceptMutation.isPending
              ? (acceptMutation.variables as string)
              : null
          }
        />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You're offline. Tap “Go online” to start receiving ride requests.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AvailableRides({
  query,
  onAccept,
  acceptingId,
}: {
  query: { isLoading: boolean; data: RideDTO[] | undefined };
  onAccept: (id: string) => void;
  acceptingId: string | null;
}) {
  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Looking for ride requests…
        </CardContent>
      </Card>
    );
  }

  const rides = query.data ?? [];
  if (rides.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No ride requests right now. New requests appear here automatically.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-muted-foreground">
        Available requests ({rides.length})
      </h2>
      {rides.map((ride) => (
        <Card key={ride.id}>
          <CardContent className="flex flex-col gap-3 py-4">
            <RideRoute ride={ride} />
            <Button
              className="h-10"
              disabled={acceptingId === ride.id}
              onClick={() => onAccept(ride.id)}
            >
              {acceptingId === ride.id ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Accepting…
                </>
              ) : (
                "Accept ride"
              )}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ActiveRideCard({
  ride,
  onAdvance,
  pending,
}: {
  ride: RideDTO;
  onAdvance: (action: "en_route" | "start" | "complete" | "cancel") => void;
  pending: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Current ride</CardTitle>
        <Badge variant="outline">{rideStatusLabel(ride.status)}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RideRoute ride={ride} />

        <div className="flex flex-col gap-2">
          {ride.status === "accepted" && (
            <Button className="h-11" disabled={pending} onClick={() => onAdvance("en_route")}>
              <Navigation className="size-4" /> Mark en route
            </Button>
          )}
          {ride.status === "driver_en_route" && (
            <Button className="h-11" disabled={pending} onClick={() => onAdvance("start")}>
              <RouteIcon className="size-4" /> Start ride
            </Button>
          )}
          {ride.status === "in_progress" && (
            <Button className="h-11" disabled={pending} onClick={() => onAdvance("complete")}>
              <CheckCircle2 className="size-4" /> Complete ride
            </Button>
          )}
          {(ride.status === "accepted" || ride.status === "driver_en_route") && (
            <Button
              variant="ghost"
              className="h-10 text-destructive hover:text-destructive"
              disabled={pending}
              onClick={() => onAdvance("cancel")}
            >
              Cancel ride
            </Button>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Car className="size-3.5" /> Live driver location syncing arrives with
          the maps phase.
        </p>
      </CardContent>
    </Card>
  );
}

function RideRoute({ ride }: { ride: RideDTO }) {
  return (
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
  );
}
