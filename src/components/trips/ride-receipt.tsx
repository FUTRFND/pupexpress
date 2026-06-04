import { Receipt } from "lucide-react";

import type { RideDTO } from "@/lib/rides.functions";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function Line({
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
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-muted-foreground" : "text-foreground"}>
        {label}
      </span>
      <span
        className={
          strong ? "font-semibold text-foreground" : "text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Itemized per-trip receipt. For riders it shows the fare, tip, any
 * cancellation fee and the total charged; for drivers it shows the fare, the
 * platform fee deduction, tip and net earnings. Values come straight from the
 * stored ride row so the receipt always reconciles with what was charged.
 */
export function RideReceipt({
  ride,
  viewerRole,
}: {
  ride: RideDTO;
  viewerRole: "rider" | "driver";
}) {
  const fare = Number(ride.ride_total ?? 0);
  const tip = Number(ride.tip_amount ?? 0);
  const platformFee = Number(ride.platform_fee ?? 0);
  const cancellationFee = Number(
    (ride as RideDTO & { cancellation_fee?: number }).cancellation_fee ?? 0,
  );

  // Nothing meaningful to show yet.
  if (fare <= 0 && cancellationFee <= 0) return null;

  const isPaid = ride.payment_status === "paid";
  const isCancelled = ride.status === "cancelled";

  const paymentBadge = isPaid
    ? { label: "Paid", variant: "default" as const }
    : ride.payment_status === "payment_failed"
      ? { label: "Payment failed", variant: "destructive" as const }
      : ride.payment_status === "payment_pending"
        ? { label: "Pending", variant: "outline" as const }
        : { label: "Unpaid", variant: "outline" as const };

  // Cancelled rides with a fee show just the fee receipt.
  if (isCancelled && cancellationFee > 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="size-4" /> Receipt
          </CardTitle>
          <Badge variant={paymentBadge.variant}>{paymentBadge.label}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Line label="Cancellation fee" value={formatCurrency(cancellationFee)} />
          <div className="my-1 border-t" />
          <Line
            label="Total"
            value={formatCurrency(cancellationFee)}
            strong
          />
          {ride.paid_at ? (
            <p className="pt-1 text-xs text-muted-foreground">
              Charged {new Date(ride.paid_at).toLocaleString()}
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const riderTotal = round2(fare + tip + cancellationFee);
  // After payment driver_earnings already includes the tip; before payment it
  // does not, so derive the displayed net from the parts for consistency.
  const driverNet = round2(fare - platformFee + tip);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="size-4" /> Receipt
        </CardTitle>
        {viewerRole === "rider" ? (
          <Badge variant={paymentBadge.variant}>{paymentBadge.label}</Badge>
        ) : (
          <Badge variant={ride.transfer_status === "driver_paid" ? "default" : "outline"}>
            {ride.transfer_status === "driver_paid" ? "Paid out" : "Pending payout"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Line label="Ride fare" value={formatCurrency(fare)} muted />
        {viewerRole === "driver" && platformFee > 0 ? (
          <Line
            label="Platform fee"
            value={`−${formatCurrency(platformFee)}`}
            muted
          />
        ) : null}
        {tip > 0 ? (
          <Line
            label={viewerRole === "driver" ? "Tip (100% yours)" : "Driver tip"}
            value={`${viewerRole === "driver" ? "+" : ""}${formatCurrency(tip)}`}
            muted
          />
        ) : null}
        {cancellationFee > 0 ? (
          <Line label="Cancellation fee" value={formatCurrency(cancellationFee)} muted />
        ) : null}
        <div className="my-1 border-t" />
        <Line
          label={viewerRole === "driver" ? "Your earnings" : "Total"}
          value={formatCurrency(viewerRole === "driver" ? driverNet : riderTotal)}
          strong
        />
        {viewerRole === "rider" && isPaid && ride.paid_at ? (
          <p className="pt-1 text-xs text-muted-foreground">
            Paid {new Date(ride.paid_at).toLocaleString()}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
