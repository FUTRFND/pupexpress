import { Car, ShieldCheck, Star } from "lucide-react";

import type { DriverInfoDTO } from "@/lib/ride-detail.functions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface DriverCardProps {
  driver: DriverInfoDTO;
}

function initials(name: string | null) {
  if (!name) return "D";
  return name
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Uber-style driver verification card shown to the rider so they can confirm
 * the person and vehicle before getting in: driver photo, name + rating, car
 * make/model/year/color, license plate, and a photo of the vehicle.
 */
export function DriverCard({ driver }: DriverCardProps) {
  const vehicle = [driver.vehicleYear, driver.vehicleColor, driver.vehicleMake, driver.vehicleModel]
    .filter(Boolean)
    .join(" ");

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-600" />
          Verify your driver
        </div>

        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14 border">
            {driver.photoUrl ? (
              <AvatarImage src={driver.photoUrl} alt={driver.name ?? "Driver"} />
            ) : null}
            <AvatarFallback>{initials(driver.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {driver.name ?? "Your driver"}
            </p>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              {driver.avgRating != null ? (
                <span>
                  {driver.avgRating.toFixed(1)}
                  <span className="text-xs"> ({driver.ratingCount})</span>
                </span>
              ) : (
                <span className="text-xs">New driver</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Car className="size-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {vehicle || "Vehicle details pending"}
              </p>
              {driver.vehicleColor ? (
                <p className="text-xs text-muted-foreground">
                  {driver.vehicleColor}
                </p>
              ) : null}
            </div>
          </div>
          {driver.licensePlate ? (
            <Badge
              variant="outline"
              className="shrink-0 border-2 font-mono text-sm tracking-widest"
            >
              {driver.licensePlate}
            </Badge>
          ) : null}
        </div>

        {driver.vehiclePhotoUrl ? (
          <img
            src={driver.vehiclePhotoUrl}
            alt="Driver's vehicle"
            className="h-40 w-full rounded-xl object-cover"
            loading="lazy"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
