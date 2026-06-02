/**
 * Loads the Google Maps JavaScript API (with the Places library) exactly once
 * using the browser-safe, referrer-restricted key provided by the Lovable
 * Google Maps Platform connector.
 *
 * The key is ONLY authorized for the Maps JS API + Places API (New) browser
 * surfaces. Geocoding / Routes must go through a backend gateway call.
 */

const BROWSER_KEY = import.meta.env
  .VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env
  .VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

const CALLBACK_NAME = "__pupxpressInitMap";

let loaderPromise: Promise<typeof google> | null = null;

export function isMapsConfigured(): boolean {
  return Boolean(BROWSER_KEY);
}

declare global {
  interface Window {
    [CALLBACK_NAME]?: () => void;
    google?: typeof google;
  }
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (!BROWSER_KEY) {
    return Promise.reject(
      new Error(
        "Google Maps is not connected yet. Connect the Google Maps Platform integration to enable maps.",
      ),
    );
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<typeof google>((resolve, reject) => {
    window[CALLBACK_NAME] = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        reject(new Error("Google Maps failed to initialize"));
      }
    };

    const params = new URLSearchParams({
      key: BROWSER_KEY,
      libraries: "places,marker",
      loading: "async",
      callback: CALLBACK_NAME,
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export interface SelectedPlace {
  address: string;
  placeId: string | null;
  lat: number;
  lng: number;
}
