import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star, Trash2, Loader2, Plus, MapPin } from "lucide-react";

import {
  listFavorites,
  addFavorite,
  deleteFavorite,
  type FavoriteLocationDTO,
} from "@/lib/favorites.functions";
import type { SelectedPlace } from "@/lib/maps-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Compact "Saved" menu used next to a place input. Lets the rider pick one of
 * their saved favorite locations to fill the field, save the currently selected
 * place, or remove a favorite. All data is rider-scoped via RLS.
 */
export function FavoritesMenu({
  currentPlace,
  onPick,
}: {
  currentPlace: SelectedPlace | null;
  onPick: (place: SelectedPlace) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const queryClient = useQueryClient();
  const listFn = useServerFn(listFavorites);
  const addFn = useServerFn(addFavorite);
  const deleteFn = useServerFn(deleteFavorite);

  const favoritesQuery = useQuery({
    queryKey: ["favorites"],
    queryFn: () => listFn(),
  });
  const favorites = favoritesQuery.data ?? [];

  const addMutation = useMutation({
    mutationFn: () => {
      if (!currentPlace) throw new Error("Select a location first");
      return addFn({
        data: {
          label: label.trim() || currentPlace.address.split(",")[0],
          address: currentPlace.address,
          placeId: currentPlace.placeId,
          lat: currentPlace.lat,
          lng: currentPlace.lng,
        },
      });
    },
    onSuccess: () => {
      toast.success("Location saved");
      setLabel("");
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't save"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't remove"),
  });

  const handlePick = (fav: FavoriteLocationDTO) => {
    if (fav.lat == null || fav.lng == null) {
      toast.error("That saved place is missing coordinates.");
      return;
    }
    onPick({
      address: fav.address,
      placeId: fav.place_id,
      lat: fav.lat,
      lng: fav.lng,
    });
    setOpen(false);
  };

  const alreadySaved =
    currentPlace != null &&
    favorites.some((f) => f.address === currentPlace.address);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
        >
          <Star className="size-3.5" /> Saved
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="max-h-56 overflow-y-auto">
          {favoritesQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : favorites.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No saved places yet.
            </p>
          ) : (
            <ul className="py-1">
              {favorites.map((fav) => (
                <li
                  key={fav.id}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent"
                >
                  <button
                    type="button"
                    onClick={() => handlePick(fav)}
                    className="flex flex-1 items-start gap-2 text-left"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{fav.label}</span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {fav.address}
                      </span>
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(fav.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {currentPlace && !alreadySaved ? (
          <div className="border-t p-2">
            <p className="mb-1.5 px-1 text-xs text-muted-foreground">
              Save “{currentPlace.address.split(",")[0]}”
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (e.g. Home, Vet)"
                className="h-8 text-sm"
                maxLength={60}
              />
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0"
                disabled={addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
