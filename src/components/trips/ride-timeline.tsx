import { Check } from "lucide-react";

import type { RideDTO } from "@/lib/rides.functions";
import { cn } from "@/lib/utils";

interface Step {
  key: string;
  label: string;
  at: string | null;
}

const ORDER = ["requested", "accepted", "driver_en_route", "driver_arrived", "in_progress", "completed"];

function formatTime(at: string | null): string | null {
  if (!at) return null;
  return new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Vertical progress timeline for a ride's lifecycle. Cancelled rides show a
 * single terminal state instead of the progression.
 */
export function RideTimeline({ ride }: { ride: RideDTO }) {
  if (ride.status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
        <span className="size-2 rounded-full bg-destructive" />
        This ride was cancelled.
      </div>
    );
  }

  const steps: Step[] = [
    { key: "requested", label: "Requested", at: ride.created_at },
    { key: "accepted", label: "Driver accepted", at: ride.accepted_at },
    { key: "driver_en_route", label: "Driver en route", at: null },
    { key: "in_progress", label: "Ride started", at: ride.started_at },
    { key: "completed", label: "Completed", at: ride.completed_at },
  ];

  const currentIndex = ORDER.indexOf(ride.status);

  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const stepIndex = ORDER.indexOf(step.key);
        const done = stepIndex <= currentIndex;
        const isCurrent = stepIndex === currentIndex;
        const isLast = i === steps.length - 1;
        const time = formatTime(step.at);

        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 bg-background",
                )}
              >
                {done ? <Check className="size-3" /> : null}
              </span>
              {!isLast ? (
                <span
                  className={cn(
                    "w-px flex-1",
                    stepIndex < currentIndex ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
            </div>
            <div className={cn("pb-4", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm",
                  done ? "font-medium text-foreground" : "text-muted-foreground",
                  isCurrent && "text-primary",
                )}
              >
                {step.label}
              </p>
              {time ? (
                <p className="text-xs text-muted-foreground">{time}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
