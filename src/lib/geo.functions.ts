import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reverseGeocodeCoord, type ReverseGeocodeResult } from "@/lib/geo.server";

const coordSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * Turn the rider's GPS coordinates into a human-readable pickup address so the
 * booking form can prefill "current location". Runs server-side because the
 * Geocoding API isn't available to the browser key.
 */
export const reverseGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => coordSchema.parse(input))
  .handler(async ({ data }): Promise<ReverseGeocodeResult> => {
    return reverseGeocodeCoord(data.lat, data.lng);
  });
