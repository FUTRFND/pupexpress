import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface DriverVerification {
  status: "not_started" | "pending" | "approved" | "rejected";
  notes: string | null;
  driverPhotoUrl: string | null;
  driversLicenseUrl: string | null;
  insuranceUrl: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehicleColor: string | null;
  licensePlate: string | null;
  vehiclePhotoUrl: string | null;
  submittedAt: string | null;
}

const VERIFICATION_COLUMNS =
  "status, notes, driver_photo_url, drivers_license_url, insurance_url, vehicle_make, vehicle_model, vehicle_year, vehicle_color, license_plate, vehicle_photo_url, submitted_at";

function toDTO(row: Record<string, unknown> | null): DriverVerification {
  return {
    status:
      (row?.status as DriverVerification["status"]) ?? "not_started",
    notes: (row?.notes as string) ?? null,
    driverPhotoUrl: (row?.driver_photo_url as string) ?? null,
    driversLicenseUrl: (row?.drivers_license_url as string) ?? null,
    insuranceUrl: (row?.insurance_url as string) ?? null,
    vehicleMake: (row?.vehicle_make as string) ?? null,
    vehicleModel: (row?.vehicle_model as string) ?? null,
    vehicleYear: (row?.vehicle_year as number) ?? null,
    vehicleColor: (row?.vehicle_color as string) ?? null,
    licensePlate: (row?.license_plate as string) ?? null,
    vehiclePhotoUrl: (row?.vehicle_photo_url as string) ?? null,
    submittedAt: (row?.submitted_at as string) ?? null,
  };
}

/** Read the signed-in driver's verification record (or a not-started default). */
export const getMyVerification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriverVerification> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("driver_verifications")
      .select(VERIFICATION_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return toDTO(data);
  });

const nextYear = new Date().getFullYear() + 1;

const submitSchema = z.object({
  driverPhotoUrl: z.string().trim().min(1).max(500),
  driversLicenseUrl: z.string().trim().min(1).max(500),
  insuranceUrl: z.string().trim().min(1).max(500),
  vehicleMake: z.string().trim().min(1).max(60),
  vehicleModel: z.string().trim().min(1).max(60),
  vehicleYear: z.number().int().min(1980).max(nextYear),
  vehicleColor: z.string().trim().min(1).max(40),
  licensePlate: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z0-9 -]+$/, "Invalid plate"),
  vehiclePhotoUrl: z.string().trim().min(1).max(500),
});

/**
 * Submit (or resubmit) the driver verification application. Stores the
 * uploaded document storage paths + vehicle details and marks the record
 * pending for review. RLS scopes everything to the signed-in user.
 */
export const submitVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data, context }): Promise<DriverVerification> => {
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("driver_verifications")
      .upsert(
        {
          user_id: userId,
          driver_photo_url: data.driverPhotoUrl,
          drivers_license_url: data.driversLicenseUrl,
          insurance_url: data.insuranceUrl,
          vehicle_make: data.vehicleMake,
          vehicle_model: data.vehicleModel,
          vehicle_year: data.vehicleYear,
          vehicle_color: data.vehicleColor,
          license_plate: data.licensePlate.toUpperCase(),
          vehicle_photo_url: data.vehiclePhotoUrl,
          status: "pending",
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select(VERIFICATION_COLUMNS)
      .single();

    if (error) throw new Error(error.message);
    return toDTO(row);
  });
