import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { quoteFare } from "./pricing.server";

const coordSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const estimateSchema = z.object({
  pickup: coordSchema,
  destination: coordSchema,
});

export interface FareEstimateDTO {
  distanceMeters: number;
  durationSeconds: number;
  rideTotal: number;
  platformFee: number;
  driverEarnings: number;
  currency: string;
}

/**
 * Estimate the fare for a trip between two coordinates. Public to any signed-in
 * rider — it only computes a price and never writes anything. The route lookup
 * and pricing run entirely server-side via the connector gateway.
 */
export const estimateFare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => estimateSchema.parse(input))
  .handler(async ({ data }): Promise<FareEstimateDTO> => {
    const quote = await quoteFare(data.pickup, data.destination);
    return {
      distanceMeters: quote.distanceMeters,
      durationSeconds: quote.durationSeconds,
      rideTotal: quote.rideTotal,
      platformFee: quote.platformFee,
      driverEarnings: quote.driverEarnings,
      currency: quote.currency,
    };
  });
