import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, MapPin, Navigation } from "lucide-react";

import {
  getRideDetail,
  getRideLatestLocation,
} from "@/lib/ride-detail.functions";
import { isActiveRide, rideStatusLabel, rideStatusVariant } from "@/lib/ride-status";
import { formatCurrency } from "@/lib/format";
import { TrackMap } from "@/components/trips/track-map";
import { RideConversation } from "@/components/trips/ride-conversation";
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

  const detailQuery = useQuery({
    queryKey: ["ride-detail", rideId],
    queryFn: () => getDetailFn({ data: { rideId } }),
  });

  const locationQuery = useQuery({
    queryKey: ["ride-location", rideId],
    queryFn: () => getLocationFn({ data: { rideId } }),
    enabled: detailQuery.isSuccess,
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

  const { ride, counterpartName, counterpartId, viewerRole } = detailQuery.data;
  const active = isActiveRide(ride.status);
  const hasCounterpart = Boolean(counterpartId);
  const canPay =
    viewerRole === "rider" &&
    ride.status === "completed" &&
    Boolean(ride.driver_id) &&
    PAYABLE.includes(ride.payment_status);

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

      {canPay ? <PayRideButton rideId={ride.id} className="h-11" /> : null}

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
