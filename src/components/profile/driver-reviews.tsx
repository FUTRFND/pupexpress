import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Star } from "lucide-react";

import { getMyDriverReviews } from "@/lib/ratings.functions";
import { StarRating } from "@/components/ratings/star-rating";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Shows the reviews riders have left for the signed-in driver on their own
 * profile: an average score, the total count, and the individual comments.
 */
export function DriverReviews() {
  const reviewsFn = useServerFn(getMyDriverReviews);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-driver-reviews"],
    queryFn: () => reviewsFn(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Your driver reviews</span>
          {data && data.count > 0 ? (
            <span className="flex items-center gap-1 text-sm font-semibold">
              <Star className="size-4 fill-amber-400 text-amber-400" />
              {data.avgRating?.toFixed(1)}
              <span className="font-normal text-muted-foreground">
                ({data.count})
              </span>
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading reviews…
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Couldn't load your reviews.</p>
        ) : !data || data.count === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reviews yet. Complete rides to start earning ratings from riders.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {data.reviews.map((review) => (
              <li
                key={review.id}
                className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {review.riderName ?? "A rider"}
                  </span>
                  <StarRating value={review.rating} size="sm" />
                </div>
                {review.comment ? (
                  <p className="text-sm text-muted-foreground">
                    {review.comment}
                  </p>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
