import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CreditCard, Loader2, ShieldAlert } from "lucide-react";

import { createCancellationFeeCheckout } from "@/lib/payments.functions";
import { useStripeSafety } from "@/components/payments/stripe-safety";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";

/**
 * Rider-facing button to pay an outstanding cancellation/no-show fee. Redirects
 * to Stripe's hosted checkout; no secret keys touch the client. Disabled when
 * Stripe is not in a safe (test/launch) mode.
 */
export function PayCancellationFeeButton({
  rideId,
  fee,
  currency = "usd",
  className,
}: {
  rideId: string;
  fee: number;
  currency?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const checkoutFn = useServerFn(createCancellationFeeCheckout);
  const { data: safety } = useStripeSafety();
  const blocked = safety ? !safety.actionsAllowed : false;

  if (blocked) {
    return (
      <Button className={className} variant="outline" disabled>
        <ShieldAlert className="size-4" /> Checkout disabled (test mode required)
      </Button>
    );
  }

  const handlePay = async () => {
    setLoading(true);
    try {
      const { url } = await checkoutFn({ data: { rideId } });
      window.location.href = url;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't start checkout",
      );
      setLoading(false);
    }
  };

  return (
    <Button className={className} variant="destructive" disabled={loading} onClick={handlePay}>
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Opening checkout…
        </>
      ) : (
        <>
          <CreditCard className="size-4" /> Pay cancellation fee{" "}
          {formatCurrency(fee, currency)}
        </>
      )}
    </Button>
  );
}
