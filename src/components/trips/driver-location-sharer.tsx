import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Loader2 } from "lucide-react";

import { pushDriverLocation } from "@/lib/ride-detail.functions";
import { Button } from "@/components/ui/button";

const MIN_INTERVAL_MS = 4000;

/**
 * Driver-only control to share live location for an active ride. Uses the
 * browser Geolocation watch API (event-driven, not polling) and throttles
 * writes to ~every 4s. Riders see the marker move in realtime via TrackMap.
 */
export function DriverLocationSharer({ rideId }: { rideId: string }) {
  const pushFn = useServerFn(pushDriverLocation);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  const stop = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
  };

  const start = () => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Location isn't available on this device.");
      return;
    }
    setSharing(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < MIN_INTERVAL_MS) return;
        lastSentRef.current = now;
        pushFn({
          data: {
            rideId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading:
              typeof pos.coords.heading === "number" &&
              !Number.isNaN(pos.coords.heading)
                ? pos.coords.heading
                : null,
          },
        }).catch(() => {
          /* transient network errors are non-fatal; next tick retries */
        });
      },
      (err) => {
        setError(err.message || "Couldn't access your location.");
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={sharing ? "secondary" : "default"}
        className="h-11"
        onClick={sharing ? stop : start}
      >
        {sharing ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sharing live location
          </>
        ) : (
          <>
            <MapPin className="size-4" /> Share my live location
          </>
        )}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
