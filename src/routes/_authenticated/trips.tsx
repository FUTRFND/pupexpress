import { useEffect } from "react";
import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MapPin, Navigation, MessageCircle } from "lucide-react";

import { useMode } from "@/hooks/use-mode";
import { listMyRides, type RideDTO } from "@/lib/rides.functions";
import { listMyDriverRides } from "@/lib/driver.functions";
import {
  rideStatusLabel,
  rideStatusVariant,
  isActiveRide,
  isOngoingRide,
  isHistoryRide,
} from "@/lib/ride-status";
import { formatCurrency } from "@/lib/format";
import { confirmRidePayment } from "@/lib/payments.functions";
import { listMyRideRatings, type RideRatingDTO } from "@/lib/ratings.functions";
import { PayRideButton } from "@/components/payments/pay-ride-button";
import { RateRideDialog } from "@/components/ratings/rate-ride-dialog";
import { CancelRideDialog } from "@/components/trips/cancel-ride-dialog";
import { RideTimeline } from "@/components/trips/ride-timeline";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TripsSearch {
  payment?: "success" | "cancelled";
  ride?: string;
}

export const Route = createFileRoute("/_authenticated/trips")({
  validateSearch: (search: Record<string, unknown>): TripsSearch => ({
    payment:
      search.payment === "success" || search.payment === "cancelled"
        ? search.payment
        : undefined,
    ride: typeof search.ride === "string" ? search.ride : undefined,
  }),
  component: TripsPage,
});

function TripsPage() {
  const { mode } = useMode();
  const search = useSearch({ from: "/_authenticated/trips" });
  const queryClient = useQueryClient();
  const listRidesFn = useServerFn(listMyRides);
  const listDriverRidesFn = useServerFn(listMyDriverRides);
  const confirmPaymentFn = useServerFn(confirmRidePayment);

  // Surface the outcome after returning from Stripe Checkout. On success we
  // actively verify the session so the ride flips to "paid" immediately
  // instead of waiting on the webhook.
  useEffect(() => {
    if (search.payment === "cancelled") {
      toast.info("Payment cancelled. You can pay anytime from Trips.");
      return;
    }
    if (search.payment !== "success") return;

    if (!search.ride) {
      toast.success("Payment received — thank you!");
      return;
    }

    let active = true;
    const toastId = toast.loading("Confirming your payment…");
    confirmPaymentFn({ data: { rideId: search.ride } })
      .then((res) => {
        if (!active) return;
        if (res.paid) {
          toast.success("Payment confirmed — thank you!", { id: toastId });
        } else {
          toast.info("Payment is processing — we'll update this shortly.", {
            id: toastId,
          });
        }
        queryClient.invalidateQueries({ queryKey: ["rides"] });
      })
      .catch(() => {
        if (!active) return;
        // Webhook remains the fallback source of truth.
        toast.success("Payment received — thank you!", { id: toastId });
        queryClient.invalidateQueries({ queryKey: ["rides"] });
      });

    return () => {
      active = false;
    };
  }, [search.payment, search.ride, confirmPaymentFn, queryClient]);

  const riderQuery = useQuery({
    queryKey: ["rides"],
    queryFn: () => listRidesFn(),
    enabled: mode === "rider",
  });


  const driverQuery = useQuery({
    queryKey: ["driver-assigned"],
    queryFn: () => listDriverRidesFn(),
    enabled: mode === "driver",
  });

  const ratingsFn = useServerFn(listMyRideRatings);
  const ratingsQuery = useQuery({
    queryKey: ["my-ride-ratings"],
    queryFn: () => ratingsFn(),
    enabled: mode === "rider",
  });
  const ratingByRide = new Map<string, RideRatingDTO>(
    (ratingsQuery.data ?? []).map((r) => [r.ride_id, r]),
  );

  const query = mode === "rider" ? riderQuery : driverQuery;
  const rides = query.data ?? [];
  const activeRides = rides.filter((r) => isOngoingRide(r.status));
  const historyRides = rides.filter((r) => isHistoryRide(r.status));

  const renderList = (list: RideDTO[], kind: "active" | "history") => {
    if (query.isLoading) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading trips…
          </CardContent>
        </Card>
      );
    }
    if (query.isError) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            Couldn't load your trips. Pull to refresh or try again.
          </CardContent>
        </Card>
      );
    }
    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {kind === "active"
              ? mode === "rider"
                ? "No active rides. Book one from Home to get started."
                : "No active trips. Go online from Home to accept ride requests."
              : "No past trips yet. Completed and cancelled rides show up here."}
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {list.map((ride) => (
          <RideCard
            key={ride.id}
            ride={ride}
            mode={mode}
            rating={ratingByRide.get(ride.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Trips</h1>
      <p className="-mt-2 text-sm text-muted-foreground">
        {mode === "rider"
          ? "Rides you've booked for your pets."
          : "Rides you've accepted as a driver."}
      </p>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Active{activeRides.length ? ` (${activeRides.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="history">
            History{historyRides.length ? ` (${historyRides.length})` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          {renderList(activeRides, "active")}
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          {renderList(historyRides, "history")}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const PAYABLE = ["unpaid", "payment_failed"];
const CANCELLABLE = ["requested", "accepted", "driver_en_route"];

function RideCard({
  ride,
  mode,
  rating,
}: {
  ride: RideDTO;
  mode: "rider" | "driver";
  rating?: RideRatingDTO;
}) {
  const queryClient = useQueryClient();
  const cancelFn = useServerFn(cancelMyRide);
  const currency = "usd";
  const canPay =
    mode === "rider" &&
    ride.status === "completed" &&
    Boolean(ride.driver_id) &&
    PAYABLE.includes(ride.payment_status);
  const canCancel = mode === "rider" && CANCELLABLE.includes(ride.status);

  const cancelMutation = useMutation({
    mutationFn: () => cancelFn({ data: { rideId: ride.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rides"] });
      toast.success("Ride cancelled");
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Couldn't cancel this ride",
      ),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={rideStatusVariant(ride.status)}>
            {rideStatusLabel(ride.status)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(ride.created_at).toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground">
                Pickup
              </span>
              <span className="text-foreground">{ride.pickup_address}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Navigation className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground">
                Drop-off
              </span>
              <span className="text-foreground">
                {ride.destination_address}
              </span>
            </div>
          </div>
        </div>

        <RideTimeline ride={ride} />

        {ride.ride_total > 0 ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {mode === "driver" ? "Your earnings" : "Ride total"}
            </span>
            <span className="font-semibold">
              {formatCurrency(
                mode === "driver" ? ride.driver_earnings : ride.ride_total,
                currency,
              )}
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Payment: {ride.payment_status}
          </Badge>
          {(mode === "driver" || ride.transfer_status !== "not_ready") && (
            <Badge variant="outline" className="text-xs">
              Transfer: {ride.transfer_status}
            </Badge>
          )}
        </div>

        <Button asChild variant="outline" className="h-10">
          <Link to="/rides/$rideId" params={{ rideId: ride.id }}>
            <MessageCircle className="size-4" />
            {isActiveRide(ride.status) ? "Track ride & chat" : "View details"}
          </Link>
        </Button>

        {canPay ? <PayRideButton rideId={ride.id} className="h-10" /> : null}

        {mode === "rider" &&
        ride.status === "completed" &&
        Boolean(ride.driver_id) ? (
          <RateRideDialog
            rideId={ride.id}
            existingRating={rating?.rating}
            existingComment={rating?.comment}
            className="h-10"
          />
        ) : null}

        {canCancel ? (
          <CancelRideDialog rideId={ride.id} className="h-10" />
        ) : null}
      </CardContent>
    </Card>
  );
}

