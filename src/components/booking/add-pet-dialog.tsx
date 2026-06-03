import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createPet } from "@/lib/pets.functions";
import { breedsForType } from "@/lib/pet-breeds";
import { BreedCombobox } from "@/components/booking/breed-combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

const PET_PHOTO_BUCKET = "pet-photos";
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB

interface AddPetDialogProps {
  trigger: React.ReactNode;
  onCreated?: (petId: string) => void;
}

export function AddPetDialog({ trigger, onCreated }: AddPetDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [petType, setPetType] = useState<"dog" | "cat" | "other">("dog");
  const [breed, setBreed] = useState("");

  // Photo state: object path saved to storage + a local preview URL.
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const createPetFn = useServerFn(createPet);

  const reset = () => {
    setName("");
    setBreed("");
    setPetType("dog");
    setPhotoPath(null);
    setPhotoPreview(null);
    setUploading(false);
  };

  const handlePhotoSelected = async (file: File | undefined) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Image is too large (max 8MB).");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(PET_PHOTO_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;

      // Remove any previously uploaded (now-orphaned) photo for this draft.
      if (photoPath) {
        await supabase.storage.from(PET_PHOTO_BUCKET).remove([photoPath]);
      }
      setPhotoPath(path);
      setPhotoPreview(URL.createObjectURL(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload photo");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (photoPath) {
      await supabase.storage.from(PET_PHOTO_BUCKET).remove([photoPath]);
    }
    setPhotoPath(null);
    setPhotoPreview(null);
  };

  const mutation = useMutation({
    mutationFn: () =>
      createPetFn({
        data: {
          name: name.trim(),
          pet_type: petType,
          breed: breed.trim() || null,
          photo_path: photoPath,
        },
      }),
    onSuccess: (pet) => {
      toast.success(`${pet.name} added`);
      queryClient.invalidateQueries({ queryKey: ["pets"] });
      setOpen(false);
      reset();
      onCreated?.(pet.id);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't add pet");
    },
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Clean up an orphaned upload if the user closes without saving.
    if (!next && photoPath && !mutation.isPending) {
      supabase.storage.from(PET_PHOTO_BUCKET).remove([photoPath]);
      reset();
    }
  };

  const breedOptions = breedsForType(petType);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            if (!name.trim() || uploading) return;
            mutation.mutate();
          }}
        >
          {/* Photo picker */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="size-24">
                {photoPreview ? <AvatarImage src={photoPreview} alt="Pet" /> : null}
                <AvatarFallback className="bg-muted text-muted-foreground">
                  {uploading ? (
                    <Loader2 className="size-6 animate-spin" />
                  ) : (
                    <Camera className="size-6" />
                  )}
                </AvatarFallback>
              </Avatar>
              {photoPreview && !uploading ? (
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute -right-1 -top-1 rounded-full bg-destructive p-1 text-destructive-foreground shadow"
                  aria-label="Remove photo"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="size-4" /> Camera
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => albumInputRef.current?.click()}
              >
                <ImagePlus className="size-4" /> Album
              </Button>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                handlePhotoSelected(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <input
              ref={albumInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handlePhotoSelected(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

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
            <Select
              value={petType}
              onValueChange={(v) => {
                setPetType(v as typeof petType);
                setBreed("");
              }}
            >
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
            {petType === "other" ? (
              <Input
                id="pet-breed"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder="Breed"
              />
            ) : (
              <BreedCombobox
                key={petType}
                id="pet-breed"
                value={breed}
                onChange={setBreed}
                options={breedOptions}
              />
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {mutation.isPending ? "Adding…" : "Add pet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
