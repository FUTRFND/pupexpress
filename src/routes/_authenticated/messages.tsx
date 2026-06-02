import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Real-time chat with your driver or rider will live here.
        </CardContent>
      </Card>
    </div>
  );
}
