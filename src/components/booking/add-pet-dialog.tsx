import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { createPet } from "@/lib/pets.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddPetDialogProps {
  trigger: React.ReactNode;
  onCreated?: (petId: string) => void;
}

export function AddPetDialog({ trigger, onCreated }: AddPetDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [petType, setPetType] = useState<"dog" | "cat" | "other">("dog");
  const [breed, setBreed] = useState("");
  const queryClient = useQueryClient();
  const createPetFn = useServerFn(createPet);

  const mutation = useMutation({
    mutationFn: (input: { name: string; pet_type: "dog" | "cat" | "other"; breed: string | null }) =>
      createPetFn({ data: input }),
    onSuccess: (pet) => {
      toast.success(`${pet.name} added`);
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      setOpen(false);
      setName("");
      setBreed("");
      setPetType("dog");
      onCreated?.(pet.id);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't add pet");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a pet</DialogTitle>
          <DialogDescription>
            Tell us who's riding so drivers know what to expect.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            mutation.mutate({
              name: name.trim(),
              pet_type: petType,
              breed: breed.trim() || null,
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pet-name">Name</Label>
            <Input
              id="pet-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Buddy"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pet-type">Type</Label>
            <Select value={petType} onValueChange={(v) => setPetType(v as typeof petType)}>
              <SelectTrigger id="pet-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dog">Dog</SelectItem>
                <SelectItem value="cat">Cat</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pet-breed">Breed (optional)</Label>
            <Input
              id="pet-breed"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="Golden Retriever"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Adding…" : "Add pet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
