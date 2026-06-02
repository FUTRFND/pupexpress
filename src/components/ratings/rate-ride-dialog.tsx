import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";

import { submitRideRating } from "@/lib/ratings.functions";
import { StarRating } from "@/components/ratings/star-rating";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RateRideDialogProps {
  rideId: string;
  driverName?: string | null;
  existingRating?: number;
  existingComment?: string | null;
  className?: string;
}

/** Lets a rider rate (or re-rate) the driver on a completed ride. */
export function RateRideDialog({
  rideId,
  driverName,
  existingRating,
  existingComment,
  className,
}: RateRideDialogProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existingRating ?? 0);
  const [comment, setComment] = useState(existingComment ?? "");
  const queryClient = useQueryClient();
  const submitFn = useServerFn(submitRideRating);

  const mutation = useMutation({
    mutationFn: () =>
      submitFn({
        data: { rideId, rating, comment: comment.trim() || null },
      }),
    onSuccess: () => {
      toast.success("Thanks for your feedback!");
      queryClient.invalidateQueries({ queryKey: ["my-ride-ratings"] });
      setOpen(false);
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Couldn't submit your rating",
      ),
  });

  const alreadyRated = typeof existingRating === "number";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={className}>
          <Star
            className={
              alreadyRated ? "size-4 fill-amber-400 text-amber-400" : "size-4"
            }
          />
          {alreadyRated ? "Edit your rating" : "Rate your driver"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Rate {driverName ?? "your driver"}
          </DialogTitle>
          <DialogDescription>
            How was your pet's ride? Your feedback helps keep PupXpress safe.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <StarRating value={rating} onChange={setRating} size="lg" />
          <Textarea
            placeholder="Add a comment (optional)"
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-24"
          />
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            disabled={rating < 1 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Submit rating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
