import { createFileRoute } from "@tanstack/react-router";

import { useMode } from "@/hooks/use-mode";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/trips")({
  component: TripsPage,
});

function TripsPage() {
  const { mode } = useMode();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Trips</h1>
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {mode === "rider"
            ? "Your past and upcoming rides will appear here."
            : "Trips you've driven and earnings will appear here."}
        </CardContent>
      </Card>
    </div>
  );
}
