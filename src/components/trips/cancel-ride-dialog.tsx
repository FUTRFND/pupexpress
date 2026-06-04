import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2, XCircle } from "lucide-react";

import { cancelMyRide, getCancellationQuote } from "@/lib/rides.functions";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const REASONS = [
  "Driver is taking too long",
  "Booked by mistake",
  "Plans changed",
  "Found another ride",
  "Other",
] as const;

interface CancelRideDialogProps {
  rideId: string;
  className?: string;
  onCancelled?: () => void;
}

/**
 * Rider-facing cancellation flow that captures a reason (preset + optional
 * note) before cancelling. The reason is stored on the ride and shared with the
 * driver so cancellations are accountable on both sides.
 */
export function CancelRideDialog({
  rideId,
  className,
  onCancelled,
}: CancelRideDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const cancelFn = useServerFn(cancelMyRide);
  const quoteFn = useServerFn(getCancellationQuote);

  const quoteQuery = useQuery({
    queryKey: ["cancellation-quote", rideId],
    queryFn: () => quoteFn({ data: { rideId } }),
    enabled: open,
  });
  const fee = quoteQuery.data?.fee ?? 0;

  const cancelMutation = useMutation({
    mutationFn: () => {
      const finalReason =
        reason === "Other" ? note.trim() || "Other" : reason;
      return cancelFn({ data: { rideId, reason: finalReason } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rides"] });
      queryClient.invalidateQueries({ queryKey: ["ride-detail", rideId] });
      toast.success(
        fee > 0
          ? `Ride cancelled — a ${formatCurrency(fee)} fee applies.`
          : "Ride cancelled",
      );
      setOpen(false);
      onCancelled?.();
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Couldn't cancel this ride",
      ),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={`text-destructive hover:text-destructive ${className ?? ""}`}
        >
          <XCircle className="size-4" /> Cancel ride
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this ride?</DialogTitle>
          <DialogDescription>
            Let us know why so we can improve. Your driver will be notified.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
          {REASONS.map((r) => (
            <div key={r} className="flex items-center gap-2">
              <RadioGroupItem value={r} id={`reason-${r}`} />
              <Label htmlFor={`reason-${r}`} className="font-normal">
                {r}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {reason === "Other" ? (
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tell us more (optional)"
            maxLength={300}
            rows={3}
          />
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Keep ride
          </Button>
          <Button
            variant="destructive"
            disabled={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            {cancelMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Cancel ride
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
