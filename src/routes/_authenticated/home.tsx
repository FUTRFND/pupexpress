import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/hooks/use-auth";
import { useMode } from "@/hooks/use-mode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Book a ride for your dog</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Pickup and drop-off booking with live maps is coming next.
            </p>
            <Button className="h-11" disabled>
              Request a ride (coming soon)
            </Button>
          </CardContent>
        </Card>
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
