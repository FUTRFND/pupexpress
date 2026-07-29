import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { useMode } from "@/hooks/use-mode";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { DriverReviews } from "@/components/profile/driver-reviews";
import { PetManager } from "@/components/profile/pet-manager";
import { ProfileMenu } from "@/components/profile/profile-menu";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { deleteMyAccount } from "@/lib/account.functions";
import { supabase } from "@/integrations/supabase/client";
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

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const { mode, setMode } = useMode();
  const navigate = useNavigate();
  const deleteAccountFn = useServerFn(deleteMyAccount);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { disableNativePush } = await import("@/lib/native-push");
      await disableNativePush();
      await deleteAccountFn();
    },
    onSuccess: async () => {
      await supabase.auth.signOut({ scope: "local" });
      setDeleteOpen(false);
      navigate({ to: "/", replace: true });
      toast.success("Your account has been permanently deleted.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Account deletion failed.");
    },
  });

  const name =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "PupXpress user";
  const avatar = user?.user_metadata?.avatar_url as string | undefined;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>

      <Card>
        <CardContent className="flex items-center gap-4 py-5">
          <Avatar className="h-14 w-14">
            <AvatarImage src={avatar} alt={name} />
            <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </CardContent>
      </Card>

      <ProfileEditor />

      {mode === "driver" ? <DriverReviews /> : null}

      <PetManager />

      <ProfileMenu />



      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mode</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            variant={mode === "rider" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode("rider")}
          >
            Rider
          </Button>
          <Button
            variant={mode === "driver" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode("driver")}
          >
            Driver
          </Button>
        </CardContent>
      </Card>

      <Button variant="destructive" className="h-11" onClick={handleSignOut}>
        Sign out
      </Button>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Delete Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Permanently delete your account, profile, pets, ride history, messages,
            saved locations, uploaded documents, and notification data.
          </p>
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete Account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md rounded-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>This cannot be undone. Type DELETE to confirm.</p>
                    <Input
                      aria-label="Type DELETE to confirm account deletion"
                      autoCapitalize="characters"
                      autoComplete="off"
                      value={deleteConfirmation}
                      onChange={(event) => setDeleteConfirmation(event.target.value)}
                      placeholder="DELETE"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteConfirmation !== "DELETE" || deleteMutation.isPending}
                  onClick={(event) => {
                    event.preventDefault();
                    deleteMutation.mutate();
                  }}
                >
                  {deleteMutation.isPending ? "Deleting…" : "Delete permanently"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
