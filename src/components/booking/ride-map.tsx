import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPinned } from "lucide-react";

import { loadGoogleMaps, isMapsConfigured, type SelectedPlace } from "@/lib/maps-loader";
import type { GeoCoords } from "@/hooks/use-geolocation";
import type { NearbyDriverPosition } from "@/lib/presence.functions";

// Default center used before any coordinates exist (San Francisco).
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

// Orange car in a white disc, used for nearby-driver markers (Uber-style).
const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32"><circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#f97316" stroke-width="1.5"/><path fill="#f97316" d="M17.4 11.1l-.7-2.1C16.5 8.4 15.9 8 15.3 8H8.7c-.6 0-1.2.4-1.4 1l-.7 2.1c-.5.3-.9.8-.9 1.4v2.1c0 .3.2.6.5.6h.5c.3 0 .5-.3.5-.6V14h9v.6c0 .3.2.6.5.6h.5c.3 0 .5-.3.5-.6v-2.1c0-.6-.4-1.1-.9-1.3zM8.7 9.2h6.6l.6 1.8H8.1l.6-1.8zM8 13c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm8 0c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z"/></svg>`;

interface RideMapProps {
  pickup: SelectedPlace | null;
  destination: SelectedPlace | null;
  /** The rider's current location, shown as a blue "you are here" dot. */
  userLocation?: GeoCoords | null;
  /** Anonymous nearby-driver positions, shown as car markers. */
  driverPositions?: NearbyDriverPosition[];
  /** Invoked when the rider taps the locate button (re-request permission). */
  onLocate?: () => void;
  className?: string;
}

export function RideMap({
  pickup,
  destination,
  userLocation,
  driverPositions,
  onLocate,
  className,
}: RideMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const driverMarkersRef = useRef<google.maps.Marker[]>([]);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  // Track whether the user has set/seen any anchor so we don't keep recentering.
  const centeredOnUserRef = useRef(false);
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

  // Center on the rider's location when it first arrives (unless they've
  // already chosen a pickup/destination to frame instead).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !window.google?.maps || !userLocation) return;

    const google = window.google;
    const pos = { lat: userLocation.lat, lng: userLocation.lng };

    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition(pos);
    } else {
      userMarkerRef.current = new google.maps.Marker({
        position: pos,
        map,
        title: "Your location",
        zIndex: 999,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#1a73e8",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
    }

    if (!centeredOnUserRef.current && !pickup && !destination) {
      map.setCenter(pos);
      map.setZoom(14);
      centeredOnUserRef.current = true;
    }
  }, [userLocation, status, pickup, destination]);

  // Update nearby-driver car markers whenever positions change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready" || !window.google?.maps) return;

    const google = window.google;
    driverMarkersRef.current.forEach((m) => m.setMap(null));
    driverMarkersRef.current = [];

    (driverPositions ?? []).forEach((d) => {
      const marker = new google.maps.Marker({
        position: { lat: d.lat, lng: d.lng },
        map,
        title: "Nearby driver",
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(CAR_SVG)}`,
          scaledSize: new google.maps.Size(30, 30),
          anchor: new google.maps.Point(15, 15),
        },
      });
      driverMarkersRef.current.push(marker);
    });
  }, [driverPositions, status]);

  // Update pickup/destination markers + bounds when points change.
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

      {status === "ready" && onLocate ? (
        <button
          type="button"
          onClick={() => {
            centeredOnUserRef.current = false;
            if (userLocation && mapRef.current) {
              mapRef.current.setCenter({
                lat: userLocation.lat,
                lng: userLocation.lng,
              });
              mapRef.current.setZoom(14);
            }
            onLocate();
          }}
          aria-label="Use my location"
          className="absolute bottom-3 right-3 z-10 flex size-10 items-center justify-center rounded-full border bg-background text-foreground shadow-md transition-colors hover:bg-accent"
        >
          <LocateFixed className="size-5" />
        </button>
      ) : null}

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
