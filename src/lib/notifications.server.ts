import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToUsers } from "@/lib/push.server";

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
    return;
  }

  // Best-effort push delivery. Group rows that share the same message so we
  // issue one FCM batch per distinct payload instead of one per recipient.
  const groups = new Map<
    string,
    { title: string; body: string | null; type: string | null; ride_id: string | null; userIds: string[] }
  >();
  for (const r of rows) {
    const key = `${r.title}\u0000${r.body ?? ""}\u0000${r.type ?? ""}\u0000${r.ride_id ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.userIds.push(r.user_id);
    } else {
      groups.set(key, {
        title: r.title,
        body: r.body ?? null,
        type: r.type ?? null,
        ride_id: r.ride_id ?? null,
        userIds: [r.user_id],
      });
    }
  }
  await Promise.allSettled(
    Array.from(groups.values()).map((g) =>
      sendPushToUsers(g.userIds, {
        title: g.title,
        body: g.body,
        data: {
          ...(g.type ? { type: g.type } : {}),
          ...(g.ride_id ? { ride_id: g.ride_id } : {}),
        },
      }),
    ),
  );
}

/**
 * Fan out a notification to every available driver (role 'driver' or 'both'),
 * excluding the rider who triggered it. Used when a new ride request opens so
 * drivers learn about work in real time. Best-effort: failures are logged only.
 */
export async function notifyAvailableDrivers(
  note: Omit<NotificationInput, "user_id">,
  excludeUserId: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["driver", "both"])
    .neq("id", excludeUserId);
  if (error) {
    console.error("Failed to load drivers for notification:", error.message);
    return;
  }
  await createNotifications((data ?? []).map((d) => ({ ...note, user_id: d.id })));
}
