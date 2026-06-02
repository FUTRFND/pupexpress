import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only server functions.
 *
 * Trust model:
 * 1. `requireSupabaseAuth` confirms the caller is signed in and gives us a
 *    Supabase client scoped to that user (RLS applies).
 * 2. We then verify the caller holds the `admin` app_role via the security-
 *    definer `has_role` RPC — roles live in `user_roles`, never on profiles.
 * 3. Only after that check do we use the service-role admin client for the
 *    cross-user reads/writes an admin dashboard needs (which bypass RLS).
 *
 * If the admin check fails we throw before touching any privileged client.
 */
async function assertAdmin(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}): Promise<void> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (data !== true) {
    throw new Error("Admin access required.");
  }
}

export interface AdminStats {
  totalUsers: number;
  totalDrivers: number;
  pendingApplications: number;
  totalRides: number;
  completedRides: number;
  grossVolume: number;
  platformFees: number;
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const unwrap = (res: { count: number | null; error: { message: string } | null }) => {
      if (res.error) throw new Error(res.error.message);
      return res.count ?? 0;
    };

    const [
      totalUsers,
      totalDrivers,
      pendingApplications,
      totalRides,
      completedRides,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .then(unwrap),
      supabaseAdmin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .in("role", ["driver", "both"])
        .then(unwrap),
      supabaseAdmin
        .from("driver_verifications")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .then(unwrap),
      supabaseAdmin
        .from("rides")
        .select("*", { count: "exact", head: true })
        .then(unwrap),
      supabaseAdmin
        .from("rides")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .then(unwrap),
    ]);

    const { data: paidRides, error: paidError } = await supabaseAdmin
      .from("rides")
      .select("ride_total, platform_fee")
      .eq("payment_status", "paid");
    if (paidError) throw new Error(paidError.message);

    let grossVolume = 0;
    let platformFees = 0;
    for (const r of paidRides ?? []) {
      grossVolume += Number(r.ride_total ?? 0);
      platformFees += Number(r.platform_fee ?? 0);
    }
    const round2 = (n: number) =>
      Math.round((n + Number.EPSILON) * 100) / 100;

    return {
      totalUsers,
      totalDrivers,
      pendingApplications,
      totalRides,
      completedRides,
      grossVolume: round2(grossVolume),
      platformFees: round2(platformFees),
    };
  });

export interface AdminDriver {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string;
  onboardingStatus: string;
  payoutsEnabled: boolean;
  createdAt: string;
  avgRating: number | null;
  ratingCount: number;
}

export const listAdminDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDriver[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, email, role, driver_onboarding_status, driver_payouts_enabled, created_at",
      )
      .in("role", ["driver", "both"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: ratings, error: ratingErr } = await supabaseAdmin
      .from("ride_ratings")
      .select("driver_id, rating");
    if (ratingErr) throw new Error(ratingErr.message);

    const agg = new Map<string, { sum: number; count: number }>();
    for (const r of ratings ?? []) {
      const cur = agg.get(r.driver_id) ?? { sum: 0, count: 0 };
      cur.sum += Number(r.rating ?? 0);
      cur.count += 1;
      agg.set(r.driver_id, cur);
    }

    return (data ?? []).map((p) => {
      const a = agg.get(p.id);
      return {
        id: p.id,
        fullName: p.full_name,
        email: p.email,
        role: p.role,
        onboardingStatus: p.driver_onboarding_status,
        payoutsEnabled: Boolean(p.driver_payouts_enabled),
        createdAt: p.created_at,
        avgRating: a ? Math.round((a.sum / a.count) * 10) / 10 : null,
        ratingCount: a?.count ?? 0,
      };
    });
  });

export interface AdminApplication {
  id: string;
  userId: string;
  applicantName: string | null;
  applicantEmail: string | null;
  status: string;
  vehicle: string;
  licensePlate: string | null;
  notes: string | null;
  submittedAt: string | null;
  createdAt: string;
}

export const listAdminApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminApplication[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("driver_verifications")
      .select(
        "id, user_id, status, vehicle_make, vehicle_model, vehicle_year, vehicle_color, license_plate, notes, submitted_at, created_at",
      )
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const nameById = new Map<string, { name: string | null; email: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      if (profErr) throw new Error(profErr.message);
      for (const p of profiles ?? []) {
        nameById.set(p.id, { name: p.full_name, email: p.email });
      }
    }

    return rows.map((r) => {
      const vehicle = [r.vehicle_year, r.vehicle_color, r.vehicle_make, r.vehicle_model]
        .filter(Boolean)
        .join(" ")
        .trim();
      const prof = nameById.get(r.user_id);
      return {
        id: r.id,
        userId: r.user_id,
        applicantName: prof?.name ?? null,
        applicantEmail: prof?.email ?? null,
        status: r.status,
        vehicle: vehicle || "Vehicle details pending",
        licensePlate: r.license_plate,
        notes: r.notes,
        submittedAt: r.submitted_at,
        createdAt: r.created_at,
      };
    });
  });

export interface AdminRide {
  id: string;
  status: string;
  paymentStatus: string;
  transferStatus: string;
  pickupAddress: string;
  destinationAddress: string;
  rideTotal: number;
  platformFee: number;
  createdAt: string;
}

export const listAdminRides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRide[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("rides")
      .select(
        "id, status, payment_status, transfer_status, pickup_address, destination_address, ride_total, platform_fee, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    return (data ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      paymentStatus: r.payment_status,
      transferStatus: r.transfer_status,
      pickupAddress: r.pickup_address,
      destinationAddress: r.destination_address,
      rideTotal: Number(r.ride_total ?? 0),
      platformFee: Number(r.platform_fee ?? 0),
      createdAt: r.created_at,
    }));
  });

/**
 * Approve or reject a driver application. Writes go through the service-role
 * client (RLS would otherwise restrict admins to their own verification row),
 * but only after the admin check above.
 */
export const reviewDriverApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        verificationId: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        notes: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ status: string }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const nextStatus = data.decision === "approve" ? "approved" : "rejected";
    const { data: updated, error } = await supabaseAdmin
      .from("driver_verifications")
      .update({
        status: nextStatus,
        notes: data.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.verificationId)
      .select("status, user_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Application not found.");

    const { createNotifications } = await import("./notifications.server");
    await createNotifications([
      {
        user_id: updated.user_id,
        title:
          data.decision === "approve"
            ? "You're approved to drive! 🎉"
            : "Driver application update",
        body:
          data.decision === "approve"
            ? "Your driver application was approved. Set up payouts to start accepting rides."
            : data.notes?.trim()
              ? data.notes.trim()
              : "Your driver application wasn't approved this time.",
        type: "driver",
      },
    ]);

    return { status: updated.status };
  });

/** Lightweight check the UI uses to decide whether to show the admin entry. */
export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean }> => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return { isAdmin: data === true };
  });
