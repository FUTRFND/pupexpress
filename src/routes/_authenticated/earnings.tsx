import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, MapPin, Navigation, Wallet } from "lucide-react";

import {
  listDriverEarnings,
  type DriverEarningRow,
} from "@/lib/connect.functions";
import { formatCurrency } from "@/lib/format";
import { rideStatusLabel, rideStatusVariant } from "@/lib/ride-status";
import { DriverPayoutCard } from "@/components/driver/payout-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/earnings")({
  component: EarningsPage,
});

const TRANSFER_LABELS: Record<string, string> = {
  not_ready: "Awaiting payment",
  ready: "Ready to transfer",
  driver_paid: "Paid out",
  failed: "Transfer failed",
};

function BackLink() {
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="icon" className="-ml-2 rounded-full">
        <Link to="/home" aria-label="Back to home">
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Button>
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Wallet className="size-5 text-primary" /> Earnings
      </h1>
    </div>
  );
}

function EarningsPage() {
  const listFn = useServerFn(listDriverEarnings);
  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["driver-earnings-history"],
    queryFn: () => listFn(),
  });

  return (
    <div className="flex flex-col gap-4">
      <BackLink />

      <DriverPayoutCard />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Earnings history
        </h2>

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading earnings…
            </CardContent>
          </Card>
        ) : isError ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">
              Couldn't load your earnings. Please try again.
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No earnings yet. Complete rides as a driver to start earning.
            </CardContent>
          </Card>
        ) : (
          rows.map((row) => <EarningCard key={row.rideId} row={row} />)
        )}
      </div>
    </div>
  );
}

function EarningCard({ row }: { row: DriverEarningRow }) {
  const date = new Date(row.completedAt ?? row.createdAt);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={rideStatusVariant(row.status)}>
            {rideStatusLabel(row.status)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {date.toLocaleDateString()} · {date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="truncate text-foreground">{row.pickupAddress}</span>
          </div>
          <div className="flex items-start gap-2">
            <Navigation className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-foreground">
              {row.destinationAddress}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-3 text-sm">
          <Row label="Ride total" value={formatCurrency(row.rideTotal)} muted />
          <Row
            label="Platform fee"
            value={`−${formatCurrency(row.platformFee)}`}
            muted
          />
          <div className="my-1 border-t" />
          <Row
            label="Your earnings"
            value={formatCurrency(row.driverEarnings)}
            strong
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Payment: {row.paymentStatus}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {TRANSFER_LABELS[row.transferStatus] ?? row.transferStatus}
          </Badge>
        </div>

        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link to="/rides/$rideId" params={{ rideId: row.rideId }}>
            View ride
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>
        {label}
      </span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
