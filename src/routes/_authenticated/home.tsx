import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dog, Plus, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useMode } from "@/hooks/use-mode";
import { listPets } from "@/lib/pets.functions";
import { createRide } from "@/lib/rides.functions";
import type { SelectedPlace } from "@/lib/maps-loader";
import { PlaceAutocomplete } from "@/components/booking/place-autocomplete";
import { RideMap } from "@/components/booking/ride-map";
import { AddPetDialog } from "@/components/booking/add-pet-dialog";
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

      {mode === "rider" ? (
        <RiderBooking />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Go online to accept trips</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Driver availability, trip requests, and payouts arrive in the
              driver phase.
            </p>
            <Button variant="secondary" className="h-11" disabled>
              Go online (coming soon)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RiderBooking() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listPetsFn = useServerFn(listPets);
  const createRideFn = useServerFn(createRide);

  const [pickup, setPickup] = useState<SelectedPlace | null>(null);
  const [destination, setDestination] = useState<SelectedPlace | null>(null);
  const [petId, setPetId] = useState<string | null>(null);

  const petsQuery = useQuery({
    queryKey: ["pets"],
    queryFn: () => listPetsFn(),
  });

  const pets = petsQuery.data ?? [];

  const rideMutation = useMutation({
    mutationFn: () => {
      if (!pickup || !destination) throw new Error("Pickup and destination required");
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
        },
      });
    },
    onSuccess: () => {
      toast.success("Ride requested! Finding a driver…");
      queryClient.invalidateQueries({ queryKey: ["rides"] });
      setPickup(null);
      setDestination(null);
      setPetId(null);
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
        <RideMap pickup={pickup} destination={destination} />

        <PlaceAutocomplete
          id="pickup"
          label="Pickup"
          placeholder="Where should we pick up?"
          value={pickup}
          onSelect={setPickup}
          onClear={() => setPickup(null)}
        />

        <PlaceAutocomplete
          id="destination"
          label="Destination"
          placeholder="Where are you headed?"
          value={destination}
          onSelect={setDestination}
          onClear={() => setDestination(null)}
        />

        <PetPicker
          pets={pets}
          loading={petsQuery.isLoading}
          selectedPetId={petId}
          onSelect={setPetId}
        />

        <Button
          className="h-11"
          disabled={!canRequest}
          onClick={() => rideMutation.mutate()}
        >
          {rideMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Requesting…
            </>
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
