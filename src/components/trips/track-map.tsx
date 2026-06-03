import { useEffect, useRef, useState } from "react";
import { Loader2, MapPinned } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { loadGoogleMaps, isMapsConfigured } from "@/lib/maps-loader";
import type { RideLocationDTO } from "@/lib/ride-detail.functions";

interface Point {
  lat: number;
  lng: number;
}

interface TrackMapProps {
  rideId: string;
  pickup: Point | null;
  destination: Point | null;
  initialDriver: RideLocationDTO | null;
  /** When true the driver marker + recentering is active (ride in progress). */
  live: boolean;
}

/**
 * Live ride map: shows pickup (A) and destination (B) markers plus a moving
 * driver marker that updates in realtime via Supabase Postgres changes on
 * `ride_locations` — no polling. Both participants share the same view.
 */
export function TrackMap({
  rideId,
  pickup,
  destination,
  initialDriver,
  live,
}: TrackMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const staticMarkersRef = useRef<google.maps.Marker[]>([]);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [driver, setDriver] = useState<RideLocationDTO | null>(initialDriver);

  // Subscribe to realtime driver location updates for this ride.
  useEffect(() => {
    if (!live) return;
    const channel = supabase
      .channel(`ride-location-${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ride_locations",
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          const row = payload.new as {
            lat: number;
            lng: number;
            heading: number | null;
            created_at: string;
          };
          setDriver({
            lat: row.lat,
            lng: row.lng,
            heading: row.heading,
            created_at: row.created_at,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId, live]);

  // Initialize the map once.
  useEffect(() => {
    let cancelled = false;
    if (!isMapsConfigured()) {
      setStatus("error");
      setMessage("Connect Google Maps to see the live map.");
      return;
    }

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: pickup ?? destination ?? { lat: 37.7749, lng: -122.4194 },
          zoom: 13,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "The map failed to load.");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Static pickup/destination markers + initial bounds.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !window.google?.maps) return;
    const google = window.google;

    staticMarkersRef.current.forEach((m) => m.setMap(null));
    staticMarkersRef.current = [];

    const points: { pos: Point; label: string }[] = [];
    if (pickup) points.push({ pos: pickup, label: "A" });
    if (destination) points.push({ pos: destination, label: "B" });

    points.forEach(({ pos, label }) => {
      const marker = new google.maps.Marker({ position: pos, map, label });
      staticMarkersRef.current.push(marker);
    });

    if (points.length === 2) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p.pos));
      if (driver) bounds.extend(driver);
      map.fitBounds(bounds, 64);
    } else if (points.length === 1) {
      map.setCenter(points[0].pos);
      map.setZoom(14);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, destination, status]);

  // Moving driver marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !window.google?.maps || !driver) return;
    const google = window.google;
    const pos = { lat: driver.lat, lng: driver.lng };

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        position: pos,
        map,
        icon: carIcon(google, driver.heading ?? 0),
        title: "Driver",
        zIndex: 999,
      });
    } else {
      driverMarkerRef.current.setPosition(pos);
      const current = driverMarkerRef.current.getIcon() as google.maps.Symbol;
      driverMarkerRef.current.setIcon(
        carIcon(google, driver.heading ?? current.rotation ?? 0),
      );
    }
    map.panTo(pos);
  }, [driver, status]);

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl border bg-muted">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading map…
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <MapPinned className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      )}

      {status === "ready" && live && !driver && (
        <div className="absolute inset-x-0 bottom-0 bg-background/90 px-3 py-2 text-center text-xs text-muted-foreground backdrop-blur">
          Waiting for the driver to share their location…
        </div>
      )}
    </div>
  );
}
