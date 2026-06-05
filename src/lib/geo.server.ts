import process from "node:process";

/**
 * Server-only reverse geocoding via the Lovable Google Maps connector gateway.
 * The browser key is NOT authorized for the Geocoding API, so this must run on
 * the server where the gateway injects the proper credentials.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export interface ReverseGeocodeResult {
  address: string;
  placeId: string | null;
}

export async function reverseGeocodeCoord(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured.");
  if (!mapsKey) throw new Error("GOOGLE_MAPS_API_KEY is not configured.");

  const res = await fetch(
    `${GATEWAY_URL}/maps/api/geocode/json?latlng=${encodeURIComponent(
      `${lat},${lng}`,
    )}`,
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
      },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Geocoding error (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    results?: { formatted_address?: string; place_id?: string }[];
  };
  const first = data.results?.[0];

  return {
    address:
      first?.formatted_address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    placeId: first?.place_id ?? null,
  };
}
