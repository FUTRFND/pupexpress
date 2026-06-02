import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  /** When provided, the stars become interactive (click to set). */
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-7",
} as const;

/** Star rating display + optional interactive picker (1–5). */
export function StarRating({
  value,
  onChange,
  size = "md",
  className,
}: StarRatingProps) {
  const interactive = typeof onChange === "function";
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const StarEl = (
          <Star
            className={cn(
              SIZES[size],
              filled
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-muted-foreground/40",
            )}
            strokeWidth={1.75}
          />
        );
        if (!interactive) return <span key={star}>{StarEl}</span>;
        return (
          <button
            key={star}
            type="button"
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            onClick={() => onChange?.(star)}
            className="rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {StarEl}
          </button>
        );
      })}
    </div>
  );
}
