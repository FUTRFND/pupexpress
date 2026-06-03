import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, PawPrint, Plus, Trash2 } from "lucide-react";

import { listPets, deletePet, type PetDTO } from "@/lib/pets.functions";
import { AddPetDialog } from "@/components/booking/add-pet-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PET_TYPE_LABELS: Record<string, string> = {
  dog: "Dog",
  cat: "Cat",
  other: "Pet",
};

/** Lists the rider's pets with add + delete management. */
export function PetManager() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listPets);
  const deleteFn = useServerFn(deletePet);

  const { data: pets = [], isLoading } = useQuery({
    queryKey: ["pets"],
    queryFn: () => listFn(),
  });

  const deleteMutation = useMutation({
    mutationFn: (petId: string) => deleteFn({ data: { petId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      toast.success("Pet removed");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't remove pet"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <PawPrint className="size-4" /> My pets
        </CardTitle>
        <AddPetDialog
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="size-4" /> Add
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading pets…
          </div>
        ) : pets.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No pets yet. Add one so drivers know who's riding.
          </p>
        ) : (
          pets.map((pet) => (
            <PetRow
              key={pet.id}
              pet={pet}
              onDelete={() => deleteMutation.mutate(pet.id)}
              deleting={
                deleteMutation.isPending &&
                deleteMutation.variables === pet.id
              }
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function PetRow({
  pet,
  onDelete,
  deleting,
}: {
  pet: PetDTO;
  onDelete: () => void;
  deleting: boolean;
}) {
  const subtitle = [PET_TYPE_LABELS[pet.pet_type] ?? "Pet", pet.breed]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-10 shrink-0">
          {pet.photo_url ? <AvatarImage src={pet.photo_url} alt={pet.name} /> : null}
          <AvatarFallback className="bg-muted">
            <PawPrint className="size-4 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{pet.name}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pet.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the pet from your profile. Past trips are not
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
