import { useCallback, useEffect, useState } from "react";

export interface GeoCoords {
  lat: number;
  lng: number;
}

export type GeoStatus =
  | "idle"
  | "prompting"
  | "granted"
  | "denied"
  | "unavailable"
  | "unsupported";

/**
 * Thin wrapper around the browser Geolocation API. Asks the user for their
 * location (triggering the native permission prompt) and exposes the resulting
 * coordinates plus a status the UI can react to.
 *
 * Pass `{ auto: true }` to request the location automatically on mount — used
 * on the booking screen so the map snaps to the rider as soon as they open it.
 */
export function useGeolocation(opts?: { auto?: boolean }) {
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("prompting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else setStatus("unavailable");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  useEffect(() => {
    if (opts?.auto) request();
  }, [opts?.auto, request]);

  return { coords, status, request };
}
