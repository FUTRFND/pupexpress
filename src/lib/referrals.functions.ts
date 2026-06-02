import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface MyReferral {
  code: string;
  totalUses: number;
  totalSavings: number;
  recentUses: { userName: string; discountAmount: number; usedAt: string }[];
}

export interface PromoValidation {
  valid: boolean;
  ownerName: string | null;
  message: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  code: string;
  totalUses: number;
  totalSavings: number;
}

/** Get (creating if needed) the signed-in user's referral code and stats. */
export const getMyReferral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyReferral> => {
    const { supabase } = context;

    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_referral_code",
    );
    if (claimError) throw new Error(claimError.message);

    const row = Array.isArray(claimed) ? claimed[0] : claimed;
    if (!row) throw new Error("Could not load your referral code.");

    // Look up the code id to fetch recent usages (RLS limits to owner).
    const { data: codeRow } = await supabase
      .from("referral_codes")
      .select("id")
      .eq("code", row.code)
      .maybeSingle();

    let recentUses: MyReferral["recentUses"] = [];
    if (codeRow?.id) {
      const { data: uses } = await supabase
        .from("referral_usage")
        .select("discount_amount, created_at")
        .eq("referral_code_id", codeRow.id)
        .order("created_at", { ascending: false })
        .limit(20);
      recentUses = (uses ?? []).map((u) => ({
        userName: "A PupXpress rider",
        discountAmount: Number(u.discount_amount ?? 0),
        usedAt: u.created_at as string,
      }));
    }

    return {
      code: row.code as string,
      totalUses: Number(row.total_uses ?? 0),
      totalSavings: Number(row.total_savings ?? 0),
      recentUses,
    };
  });

/** Validate a promo/referral code for the signed-in rider. */
export const validatePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .min(3, "Code is too short")
          .max(20, "Code is too long")
          .regex(/^[A-Za-z0-9-]+$/, "Invalid code format"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PromoValidation> => {
    const { supabase } = context;

    const { data: result, error } = await supabase.rpc(
      "validate_referral_code",
      { _code: data.code },
    );
    if (error) throw new Error(error.message);

    const row = Array.isArray(result) ? result[0] : result;
    if (!row) {
      return { valid: false, ownerName: null, message: "Referral code not found" };
    }

    if (row.valid) {
      return {
        valid: true,
        ownerName: row.owner_name ?? null,
        message: "Valid! 25% off your first ride 🎉",
      };
    }

    return {
      valid: false,
      ownerName: null,
      message: row.reason ?? "Invalid code",
    };
  });

/** Public-to-signed-in leaderboard of top referrers. */
export const getReferralLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LeaderboardEntry[]> => {
    const { supabase } = context;

    const { data, error } = await supabase.rpc("get_referral_leaderboard", {
      _limit: 50,
    });
    if (error) throw new Error(error.message);

    return (data ?? []).map((entry: Record<string, unknown>, index: number) => ({
      rank: index + 1,
      name: (entry.name as string) ?? "Anonymous",
      code: entry.code as string,
      totalUses: Number(entry.total_uses ?? 0),
      totalSavings: Number(entry.total_savings ?? 0),
    }));
  });
