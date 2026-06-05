import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dog, Plus, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useMode } from "@/hooks/use-mode";
import { useGeolocation } from "@/hooks/use-geolocation";
import { listPets } from "@/lib/pets.functions";
import { createRide } from "@/lib/rides.functions";
import { getNearbyDrivers } from "@/lib/presence.functions";
import { reverseGeocode } from "@/lib/geo.functions";
import type { SelectedPlace } from "@/lib/maps-loader";
import { PlaceAutocomplete } from "@/components/booking/place-autocomplete";
import { RideMap } from "@/components/booking/ride-map";
import { NearbyDrivers } from "@/components/booking/nearby-drivers";
import { FareEstimate } from "@/components/booking/fare-estimate";
import { ScheduleRidePicker } from "@/components/booking/schedule-ride-picker";
import { AddPetDialog } from "@/components/booking/add-pet-dialog";
import { PromoCodeInput, type PromoState } from "@/components/booking/promo-code-input";
import type { FareEstimateDTO } from "@/lib/fare.functions";
import { DriverPanel } from "@/components/driver/driver-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();
  const { mode } = useMode();
  const name =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "there";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hi, {name} 👋</h1>
        <p className="text-sm text-muted-foreground">
          You're in <span className="font-medium capitalize">{mode}</span> mode.
        </p>
      </div>

      {mode === "rider" ? <RiderBooking /> : <DriverPanel />}
    </div>
  );
}

function RiderBooking() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listPetsFn = useServerFn(listPets);
  const createRideFn = useServerFn(createRide);
  const nearbyFn = useServerFn(getNearbyDrivers);
  const reverseGeocodeFn = useServerFn(reverseGeocode);

  // Ask for the rider's location on open so the map snaps to them.
  const { coords: userLocation, status: geoStatus, request: requestLocation } =
    useGeolocation({ auto: true });

  const [pickup, setPickup] = useState<SelectedPlace | null>(null);
  const [destination, setDestination] = useState<SelectedPlace | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [promo, setPromo] = useState<PromoState | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [, setQuote] = useState<FareEstimateDTO | null>(null);
  const handleQuote = useCallback(
    (q: FareEstimateDTO | null) => setQuote(q),
    [],
  );

  // Prefill pickup with the rider's current location once (reverse-geocoded),
  // unless they've already chosen one.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current || pickup || !userLocation) return;
    prefilledRef.current = true;
    reverseGeocodeFn({ data: { lat: userLocation.lat, lng: userLocation.lng } })
      .then((res) => {
        setPickup((current) =>
          current
            ? current
            : {
                address: res.address,
                placeId: res.placeId,
                lat: userLocation.lat,
                lng: userLocation.lng,
              },
        );
      })
      .catch(() => {
        /* non-fatal: rider can still type a pickup */
      });
  }, [userLocation, pickup, reverseGeocodeFn]);

  // Drivers shown around the rider — anchored to the pickup, or their live
  // location before a pickup is chosen.
  const origin = pickup ?? userLocation;
  const nearbyQuery = useQuery({
    queryKey: ["nearby-drivers", origin?.lat, origin?.lng],
    queryFn: () =>
      nearbyFn({ data: { pickup: { lat: origin!.lat, lng: origin!.lng } } }),
    enabled: Boolean(origin),
    refetchInterval: 15000,
    staleTime: 10000,
  });
  const nearby = nearbyQuery.data;



  const petsQuery = useQuery({
    queryKey: ["pets"],
    queryFn: () => listPetsFn(),
  });

  const pets = petsQuery.data ?? [];

  const rideMutation = useMutation({
    mutationFn: () => {
      if (!pickup || !destination) throw new Error("Pickup and destination required");
      let scheduledIso: string | null = null;
      if (scheduleEnabled) {
        if (!scheduledFor) throw new Error("Pick a date and time, or turn off scheduling.");
        const when = new Date(scheduledFor);
        if (Number.isNaN(when.getTime())) throw new Error("That pickup time isn't valid.");
        if (when.getTime() <= Date.now() + 5 * 60 * 1000) {
          throw new Error("Choose a pickup time at least 5 minutes from now.");
        }
        scheduledIso = when.toISOString();
      }
      return createRideFn({
        data: {
          pickup: {
            address: pickup.address,
            placeId: pickup.placeId,
            lat: pickup.lat,
            lng: pickup.lng,
          },
          destination: {
            address: destination.address,
            placeId: destination.placeId,
            lat: destination.lat,
            lng: destination.lng,
          },
          petId: petId ?? null,
          referralCode: promo?.valid ? promo.code : null,
          scheduledFor: scheduledIso,
        },
      });
    },
    onSuccess: () => {
      toast.success(
        scheduleEnabled
          ? "Ride scheduled! We'll find a driver before pickup."
          : "Ride requested! Finding a driver…",
      );
      queryClient.invalidateQueries({ queryKey: ["rides"] });
      setPickup(null);
      setDestination(null);
      setPetId(null);
      setPromo(null);
      setScheduleEnabled(false);
      setScheduledFor("");
      navigate({ to: "/trips" });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't request ride");
    },
  });

  const canRequest = Boolean(pickup && destination) && !rideMutation.isPending;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Book a ride for your pet</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RideMap
          pickup={pickup}
          destination={destination}
          userLocation={userLocation}
          driverPositions={nearby?.positions}
          onLocate={requestLocation}
        />

        {geoStatus === "denied" ? (
          <p className="text-xs text-muted-foreground">
            Location access is off. Enable it in your browser settings or set a
            pickup manually to see drivers around you.
          </p>
        ) : null}

        <PlaceAutocomplete
          id="pickup"
          label="Pickup"
          placeholder="Where should we pick up?"
          value={pickup}
          onSelect={setPickup}
          onClear={() => setPickup(null)}
          enableFavorites
        />

        <PlaceAutocomplete
          id="destination"
          label="Destination"
          placeholder="Where are you headed?"
          value={destination}
          onSelect={setDestination}
          onClear={() => setDestination(null)}
          enableFavorites
        />

        <NearbyDrivers pickup={pickup} />

        <FareEstimate
          pickup={pickup}
          destination={destination}
          onQuote={handleQuote}
        />

        <ScheduleRidePicker
          enabled={scheduleEnabled}
          value={scheduledFor}
          onToggle={setScheduleEnabled}
          onChange={setScheduledFor}
        />


        <PetPicker
          pets={pets}
          loading={petsQuery.isLoading}
          selectedPetId={petId}
          onSelect={setPetId}
        />

        <PromoCodeInput onValidatedChange={setPromo} />


        <Button
          className="h-11"
          disabled={!canRequest}
          onClick={() => rideMutation.mutate()}
        >
          {rideMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />{" "}
              {scheduleEnabled ? "Scheduling…" : "Requesting…"}
            </>
          ) : scheduleEnabled ? (
            "Schedule ride"
          ) : (
            "Request ride"
          )}
        </Button>
        {!pickup || !destination ? (
          <p className="text-center text-xs text-muted-foreground">
            Set both pickup and destination to request a ride.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PetPicker({
  pets,
  loading,
  selectedPetId,
  onSelect,
}: {
  pets: { id: string; name: string; pet_type: string }[];
  loading: boolean;
  selectedPetId: string | null;
  onSelect: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading pets…
      </div>
    );
  }

  if (pets.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Dog className="size-4" /> No pets yet
        </div>
        <p className="text-xs text-muted-foreground">
          Add a pet so drivers know who's riding. You can still request a ride
          without one.
        </p>
        <AddPetDialog
          trigger={
            <Button variant="outline" size="sm" type="button">
              <Plus className="size-4" /> Add a pet
            </Button>
          }
          onCreated={(id) => onSelect(id)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Pet</span>
        <AddPetDialog
          trigger={
            <Button variant="ghost" size="sm" type="button">
              <Plus className="size-4" /> Add
            </Button>
          }
          onCreated={(id) => onSelect(id)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {pets.map((pet) => (
          <button
            key={pet.id}
            type="button"
            onClick={() => onSelect(pet.id === selectedPetId ? "" : pet.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              pet.id === selectedPetId
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-accent",
            )}
          >
            {pet.name}
          </button>
        ))}
      </div>
    </div>
  );
}
