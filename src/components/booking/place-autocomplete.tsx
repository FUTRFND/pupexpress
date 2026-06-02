import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  loadGoogleMaps,
  isMapsConfigured,
  type SelectedPlace,
} from "@/lib/maps-loader";

interface Suggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

interface PlaceAutocompleteProps {
  id: string;
  label: string;
  placeholder: string;
  value: SelectedPlace | null;
  onSelect: (place: SelectedPlace) => void;
  onClear: () => void;
}

export function PlaceAutocomplete({
  id,
  label,
  placeholder,
  value,
  onSelect,
  onClear,
}: PlaceAutocompleteProps) {
  const [query, setQuery] = useState(value?.address ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value?.address ?? "");
  }, [value?.address]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchSuggestions = (input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (input.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const google = await loadGoogleMaps();
        const { AutocompleteSuggestion, AutocompleteSessionToken } =
          (await google.maps.importLibrary(
            "places",
          )) as google.maps.PlacesLibrary;

        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }

        const { suggestions: results } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            sessionToken: sessionTokenRef.current,
          });

        const mapped: Suggestion[] = results
          .map((s) => s.placePrediction)
          .filter((p): p is google.maps.places.PlacePrediction => p != null)
          .map((p) => ({
            placeId: p.placeId,
            primary: p.mainText?.text ?? p.text.text,
            secondary: p.secondaryText?.text ?? "",
          }));

        setSuggestions(mapped);
        setOpen(mapped.length > 0);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't load suggestions",
        );
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelect = async (suggestion: Suggestion) => {
    setOpen(false);
    setLoading(true);
    setError(null);
    try {
      const google = await loadGoogleMaps();
      const { Place } = (await google.maps.importLibrary(
        "places",
      )) as google.maps.PlacesLibrary;

      const place = new Place({ id: suggestion.placeId });
      await place.fetchFields({
        fields: ["location", "formattedAddress", "displayName"],
      });

      const loc = place.location;
      if (!loc) throw new Error("That place has no location");

      const selected: SelectedPlace = {
        address: place.formattedAddress ?? suggestion.primary,
        placeId: suggestion.placeId,
        lat: loc.lat(),
        lng: loc.lng(),
      };
      setQuery(selected.address);
      sessionTokenRef.current = null;
      onSelect(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't select place");
    } finally {
      setLoading(false);
    }
  };

  const configured = isMapsConfigured();

  return (
    <div className="relative flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          className="h-11 pl-9 pr-9"
          placeholder={configured ? placeholder : "Connect Google Maps to search"}
          value={query}
          disabled={!configured}
          autoComplete="off"
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            if (value) onClear();
            fetchSuggestions(next);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 150);
          }}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {open && suggestions.length > 0 && (
        <ul className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
              >
                <span className="font-medium text-foreground">{s.primary}</span>
                {s.secondary && (
                  <span className="text-xs text-muted-foreground">
                    {s.secondary}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
