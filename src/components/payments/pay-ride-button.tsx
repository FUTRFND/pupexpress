import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CreditCard, Loader2, ShieldAlert, Heart } from "lucide-react";

import { createRideCheckout } from "@/lib/payments.functions";
import { useStripeSafety } from "@/components/payments/stripe-safety";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TIP_PERCENTS = [0, 0.15, 0.18, 0.2] as const;

/**
 * Pay Now button for a rider. Opens a dialog so the rider can add an optional
 * tip (100% of which goes to the driver) before being redirected to Stripe's
 * hosted checkout. No secret keys touch the client — only the returned URL.
 *
 * SAFETY: disabled whenever Stripe is not in a safe (test/launch) mode.
 */
export function PayRideButton({
  rideId,
  rideTotal,
  currency = "usd",
  className,
}: {
  rideId: string;
  rideTotal: number;
  currency?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number>(0);
  const [customTip, setCustomTip] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const checkoutFn = useServerFn(createRideCheckout);
  const { data: safety } = useStripeSafety();
  const blocked = safety ? !safety.actionsAllowed : false;

  const tip = useMemo(() => {
    if (useCustom) {
      const parsed = Number.parseFloat(customTip);
      return Number.isFinite(parsed) && parsed > 0
        ? Math.round(parsed * 100) / 100
        : 0;
    }
    return Math.round(rideTotal * selected * 100) / 100;
  }, [useCustom, customTip, rideTotal, selected]);

  const total = Math.round((rideTotal + tip) * 100) / 100;

  const handlePay = async () => {
    setLoading(true);
    try {
      const { url } = await checkoutFn({ data: { rideId, tip } });
      window.location.href = url;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't start checkout",
      );
      setLoading(false);
    }
  };

  if (blocked) {
    return (
      <Button className={className} variant="outline" disabled>
        <ShieldAlert className="size-4" /> Checkout disabled (test mode required)
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={className}>
          <CreditCard className="size-4" /> Pay now
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="size-4 text-primary" /> Add a tip?
          </DialogTitle>
          <DialogDescription>
            100% of your tip goes directly to the driver. Tipping is optional.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {TIP_PERCENTS.map((pct) => {
            const isActive = !useCustom && selected === pct;
            const amount = Math.round(rideTotal * pct * 100) / 100;
            return (
              <button
                key={pct}
                type="button"
                onClick={() => {
                  setUseCustom(false);
                  setSelected(pct);
                }}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl border py-3 text-sm transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted",
                )}
              >
                <span className="font-semibold">
                  {pct === 0 ? "No tip" : `${Math.round(pct * 100)}%`}
                </span>
                {pct > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(amount, currency)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="custom-tip">Custom tip</Label>
          <Input
            id="custom-tip"
            inputMode="decimal"
            placeholder="0.00"
            value={customTip}
            onFocus={() => setUseCustom(true)}
            onChange={(e) => {
              setUseCustom(true);
              setCustomTip(e.target.value.replace(/[^0-9.]/g, ""));
            }}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold">{formatCurrency(total, currency)}</span>
        </div>

        <DialogFooter>
          <Button className="w-full" disabled={loading} onClick={handlePay}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Opening checkout…
              </>
            ) : (
              <>
                <CreditCard className="size-4" />
                {tip > 0
                  ? `Pay ${formatCurrency(total, currency)}`
                  : `Pay ${formatCurrency(rideTotal, currency)}`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
