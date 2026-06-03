import { useEffect } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MapPin, Navigation, RouteIcon } from "lucide-react";

import { startRideAsRider } from "@/lib/rides.functions";
import { simulateDemoDriverLocation } from "@/lib/demo.functions";

import {
  getRideDetail,
  getRideLatestLocation,
} from "@/lib/ride-detail.functions";
import { listMyRideRatings } from "@/lib/ratings.functions";
import { RateRideDialog } from "@/components/ratings/rate-ride-dialog";
import { isActiveRide, rideStatusLabel, rideStatusVariant } from "@/lib/ride-status";
import { formatCurrency } from "@/lib/format";
import { TrackMap } from "@/components/trips/track-map";
import { DriverCard } from "@/components/trips/driver-card";
import { RideConversation } from "@/components/trips/ride-conversation";
import { DEMO_DRIVER_NAME } from "@/lib/demo.functions";
import { RideTimeline } from "@/components/trips/ride-timeline";
import { DriverLocationSharer } from "@/components/trips/driver-location-sharer";
import { PayRideButton } from "@/components/payments/pay-ride-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/rides/$rideId")({
  component: RideDetailPage,
  errorComponent: ({ error }) => (
    <div className="flex flex-col gap-3">
      <BackLink />
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {error instanceof Error ? error.message : "Couldn't load this ride."}
        </CardContent>
      </Card>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex flex-col gap-3">
      <BackLink />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          This ride couldn't be found.
        </CardContent>
      </Card>
    </div>
  ),
});

function BackLink() {
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="icon" className="-ml-2 rounded-full">
        <Link to="/trips" aria-label="Back to trips">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Button>
      <h1 className="text-2xl font-bold tracking-tight">Ride details</h1>
    </div>
  );
}

const PAYABLE = ["unpaid", "payment_failed"];

function RideDetailPage() {
  const router = useRouter();
  const { rideId } = Route.useParams();
  const getDetailFn = useServerFn(getRideDetail);
  const getLocationFn = useServerFn(getRideLatestLocation);
  const ratingsFn = useServerFn(listMyRideRatings);

  const detailQuery = useQuery({
    queryKey: ["ride-detail", rideId],
    queryFn: () => getDetailFn({ data: { rideId } }),
  });

  const locationQuery = useQuery({
    queryKey: ["ride-location", rideId],
    queryFn: () => getLocationFn({ data: { rideId } }),
    enabled: detailQuery.isSuccess,
  });

  const ratingsQuery = useQuery({
    queryKey: ["my-ride-ratings"],
    queryFn: () => ratingsFn(),
    enabled: detailQuery.isSuccess,
  });

  const startFn = useServerFn(startRideAsRider);
  const startMutation = useMutation({
    mutationFn: (id: string) => startFn({ data: { rideId: id } }),
    onSuccess: () => {
      toast.success("Ride started — enjoy the trip!");
      router.invalidate();
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Couldn't start the ride.",
      ),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading ride…
        </div>
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {detailQuery.error instanceof Error
              ? detailQuery.error.message
              : "Couldn't load this ride."}
            <div className="mt-3">
              <Button variant="outline" onClick={() => router.invalidate()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { ride, counterpartName, counterpartId, viewerRole, driverInfo } =
    detailQuery.data;
  const active = isActiveRide(ride.status);
  const hasCounterpart = Boolean(counterpartId);
  const isDemo = import.meta.env.DEV && counterpartName === DEMO_DRIVER_NAME;
  const canPay =
    viewerRole === "rider" &&
    ride.status === "completed" &&
    Boolean(ride.driver_id) &&
    PAYABLE.includes(ride.payment_status);

  const canReview =
    viewerRole === "rider" &&
    ride.status === "completed" &&
    Boolean(ride.driver_id);
  const myRating = (ratingsQuery.data ?? []).find((r) => r.ride_id === ride.id);

  const canStart = viewerRole === "rider" && ride.status === "driver_arrived";

  return (
    <div className="flex flex-col gap-4">
      <BackLink />

      <div className="flex items-center justify-between gap-2">
        <Badge variant={rideStatusVariant(ride.status)}>
          {rideStatusLabel(ride.status)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(ride.created_at).toLocaleString()}
        </span>
      </div>

      <TrackMap
        rideId={ride.id}
        pickup={
          ride.pickup_lat != null && ride.pickup_lng != null
            ? { lat: ride.pickup_lat, lng: ride.pickup_lng }
            : null
        }
        destination={
          ride.destination_lat != null && ride.destination_lng != null
            ? { lat: ride.destination_lat, lng: ride.destination_lng }
            : null
        }
        initialDriver={locationQuery.data ?? null}
        live={active}
      />

      {isDemo && active && viewerRole === "rider" ? (
        <DemoDriverSimulator rideId={ride.id} />
      ) : null}

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

      {driverInfo ? <DriverCard driver={driverInfo} /> : null}


      {ride.ride_total > 0 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {viewerRole === "driver" ? "Your earnings" : "Ride total"}
          </span>
          <span className="font-semibold">
            {formatCurrency(
              viewerRole === "driver" ? ride.driver_earnings : ride.ride_total,
            )}
          </span>
        </div>
      ) : null}

      {viewerRole === "driver" && active ? (
        <DriverLocationSharer rideId={ride.id} />
      ) : null}

      {canStart ? (
        <Button
          className="h-12 w-full text-base"
          disabled={startMutation.isPending}
          onClick={() => startMutation.mutate()}
        >
          {startMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RouteIcon className="size-4" />
          )}
          Driver's here — start ride
        </Button>
      ) : null}



      {canPay ? <PayRideButton rideId={ride.id} className="h-11" /> : null}

      {canReview ? (
        <RateRideDialog
          rideId={ride.id}
          driverName={counterpartName}
          existingRating={myRating?.rating}
          existingComment={myRating?.comment}
          className="h-11 w-full"
        />
      ) : null}

      <Card>
        <CardContent className="py-4">
          <RideTimeline ride={ride} />
        </CardContent>
      </Card>

      {hasCounterpart ? (
        <RideConversation
          rideId={ride.id}
          counterpartName={counterpartName}
          disabled={ride.status === "cancelled"}
          demoMode={isDemo}
        />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {viewerRole === "rider"
              ? "Chat opens as soon as a driver accepts your ride."
              : "No rider conversation available."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Drives the simulated demo driver's car along the route every few seconds so a
 * single test account can preview the Uber-style live tracking. Renders nothing
 * — the car appears/moves on the map via realtime location inserts.
 */
function DemoDriverSimulator({ rideId }: { rideId: string }) {
  const simulateFn = useServerFn(simulateDemoDriverLocation);

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      simulateFn({ data: { rideId } }).catch(() => {
        /* transient errors are non-fatal; the next tick retries */
      });
    };
    tick();
    const id = setInterval(tick, 3500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [rideId, simulateFn]);

  return null;
}
