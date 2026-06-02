import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Server-only helper for creating in-app notifications.
 *
 * Notifications are inserted with the service-role client because there is no
 * INSERT policy for end users on the `notifications` table — only the system
 * may create them. Callers always import this dynamically from inside a server
 * function handler so the module never leaks into a client bundle.
 *
 * Inserts are best-effort: a failure here is logged but never throws, so the
 * parent action (accepting a ride, sending a message, etc.) still succeeds.
 */
export interface NotificationInput {
  user_id: string;
  title: string;
  body?: string | null;
  type?: string | null;
  ride_id?: string | null;
}

export async function createNotifications(
  rows: NotificationInput[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin.from("notifications").insert(
    rows.map((r) => ({
      user_id: r.user_id,
      title: r.title,
      body: r.body ?? null,
      type: r.type ?? null,
      ride_id: r.ride_id ?? null,
    })),
  );
  if (error) {
    console.error("Failed to create notifications:", error.message);
  }
}
