/** Shared ride lifecycle status presentation helpers (rider + driver views). */

export const RIDE_STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  accepted: "Accepted",
  driver_en_route: "Driver en route",
  driver_arrived: "Driver arrived",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  payment_pending: "Payment pending",
  paid: "Paid",
  payment_failed: "Payment failed",
  refunded: "Refunded",
};

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export function rideStatusVariant(status: string): BadgeVariant {
  if (status === "completed") return "default";
  if (status === "cancelled") return "destructive";
  if (status === "requested") return "secondary";
  return "outline";
}

export function rideStatusLabel(status: string): string {
  return RIDE_STATUS_LABELS[status] ?? status;
}

/** A ride is "active" while it is being fulfilled (not finished/cancelled). */
export const ACTIVE_RIDE_STATUSES = [
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
] as const;

export function isActiveRide(status: string): boolean {
  return (ACTIVE_RIDE_STATUSES as readonly string[]).includes(status);
}

/** A ride still in the booking/fulfilment pipeline (shows in the Active tab). */
export function isOngoingRide(status: string): boolean {
  return status !== "completed" && status !== "cancelled";
}

/** A ride that has finished or been cancelled (shows in the History tab). */
export function isHistoryRide(status: string): boolean {
  return status === "completed" || status === "cancelled";
}
