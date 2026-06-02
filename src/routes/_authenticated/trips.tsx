import { useEffect } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MapPin, Navigation } from "lucide-react";

import { useMode } from "@/hooks/use-mode";
import { listMyRides, type RideDTO } from "@/lib/rides.functions";
import { listMyDriverRides } from "@/lib/driver.functions";
import { rideStatusLabel, rideStatusVariant } from "@/lib/ride-status";
import { formatCurrency } from "@/lib/format";
import { PayRideButton } from "@/components/payments/pay-ride-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const listRidesFn = useServerFn(listMyRides);
  const listDriverRidesFn = useServerFn(listMyDriverRides);

  // Surface the outcome after returning from Stripe Checkout.
  useEffect(() => {
    if (search.payment === "success") {
      toast.success("Payment received — thank you!");
    } else if (search.payment === "cancelled") {
      toast.info("Payment cancelled. You can pay anytime from Trips.");
    }
  }, [search.payment]);

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

  const query = mode === "rider" ? riderQuery : driverQuery;
  const rides = query.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Trips</h1>
      <p className="-mt-2 text-sm text-muted-foreground">
        {mode === "rider"
          ? "Rides you've booked for your pets."
          : "Rides you've accepted as a driver."}
      </p>

      {query.isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading trips…
          </CardContent>
        </Card>
      ) : query.isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            Couldn't load your trips. Pull to refresh or try again.
          </CardContent>
        </Card>
      ) : rides.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {mode === "rider"
              ? "No rides yet. Book one from Home to get started."
              : "No trips yet. Go online from Home to accept ride requests."}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rides.map((ride) => (
            <RideCard key={ride.id} ride={ride} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}

const PAYABLE = ["unpaid", "payment_failed"];

function RideCard({ ride, mode }: { ride: RideDTO; mode: "rider" | "driver" }) {
  const currency = "usd";
  const canPay =
    mode === "rider" &&
    ride.status === "completed" &&
    Boolean(ride.driver_id) &&
    PAYABLE.includes(ride.payment_status);

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

        {canPay ? <PayRideButton rideId={ride.id} className="h-10" /> : null}
      </CardContent>
    </Card>
  );
}

