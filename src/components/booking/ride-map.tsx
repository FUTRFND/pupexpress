import { useEffect, useRef, useState } from "react";
import { Loader2, MapPinned } from "lucide-react";

import { loadGoogleMaps, isMapsConfigured, type SelectedPlace } from "@/lib/maps-loader";

// Default center used before any coordinates exist (San Francisco).
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

interface RideMapProps {
  pickup: SelectedPlace | null;
  destination: SelectedPlace | null;
  className?: string;
}

export function RideMap({ pickup, destination, className }: RideMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string>("");

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
          center: DEFAULT_CENTER,
          zoom: 12,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          err instanceof Error ? err.message : "The map failed to load.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Update markers + bounds when points change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !window.google?.maps) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const google = window.google;
    const points: { pos: google.maps.LatLngLiteral; label: string }[] = [];
    if (pickup) points.push({ pos: { lat: pickup.lat, lng: pickup.lng }, label: "A" });
    if (destination)
      points.push({ pos: { lat: destination.lat, lng: destination.lng }, label: "B" });

    points.forEach(({ pos, label }) => {
      const marker = new google.maps.Marker({ position: pos, map, label });
      markersRef.current.push(marker);
    });

    if (points.length === 1) {
      map.setCenter(points[0].pos);
      map.setZoom(14);
    } else if (points.length === 2) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p.pos));
      map.fitBounds(bounds, 64);
    }
  }, [pickup, destination, status]);

  return (
    <div
      className={
        "relative h-56 w-full overflow-hidden rounded-xl border bg-muted " +
        (className ?? "")
      }
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading map…
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <MapPinned className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      )}
    </div>
  );
}
