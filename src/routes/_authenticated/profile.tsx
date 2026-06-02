import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/hooks/use-auth";
import { useMode } from "@/hooks/use-mode";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const { mode, setMode } = useMode();
  const navigate = useNavigate();

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
            <AvatarFallback>
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
