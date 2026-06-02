import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";

import { createRideCheckout } from "@/lib/payments.functions";
import { Button } from "@/components/ui/button";

/**
 * Pay Now button for a rider. Creates a Stripe Checkout Session server-side and
 * redirects the browser to Stripe's hosted checkout. No secret keys touch the
 * client — only the returned session URL.
 */
export function PayRideButton({
  rideId,
  className,
}: {
  rideId: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const checkoutFn = useServerFn(createRideCheckout);

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
    <Button className={className} disabled={loading} onClick={handlePay}>
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Opening checkout…
        </>
      ) : (
        <>
          <CreditCard className="size-4" /> Pay now
        </>
      )}
    </Button>
  );
}
