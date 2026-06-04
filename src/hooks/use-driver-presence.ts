import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";

import { updateDriverPresence, goOffline } from "@/lib/presence.functions";

const MIN_INTERVAL_MS = 8000;

/**
 * While a driver is online, broadcast their live location to the presence table
 * so riders can see nearby-driver counts and pickup ETAs. Uses the browser
 * Geolocation watch API (event-driven) throttled to ~every 8s, and flips the
 * driver to offline when they toggle off or leave the screen.
 */
export function useDriverPresence(online: boolean) {
  const updateFn = useServerFn(updateDriverPresence);
  const offlineFn = useServerFn(goOffline);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (!online || !("geolocation" in navigator)) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < MIN_INTERVAL_MS) return;
        lastSentRef.current = now;
        updateFn({
          data: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading:
              typeof pos.coords.heading === "number" &&
              !Number.isNaN(pos.coords.heading)
                ? pos.coords.heading
                : null,
            isOnline: true,
          },
        }).catch(() => {
          /* transient errors are non-fatal; next tick retries */
        });
      },
      () => {
        /* geolocation denied/unavailable — presence simply won't update */
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 10000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      // Best-effort: mark offline when the driver toggles off or unmounts.
      offlineFn().catch(() => {});
    };
  }, [online, updateFn, offlineFn]);
}
