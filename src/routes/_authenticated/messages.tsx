import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MessageCircle, ChevronRight, MapPin, Sparkles } from "lucide-react";

import { listConversations } from "@/lib/ride-detail.functions";
import { createDemoConversation } from "@/lib/demo.functions";
import { rideStatusLabel, rideStatusVariant } from "@/lib/ride-status";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
});

function relativeTime(at: string | null): string {
  if (!at) return "";
  const diff = Date.now() - new Date(at).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(at).toLocaleDateString();
}

function MessagesPage() {
  const router = useRouter();
  const listFn = useServerFn(listConversations);
  const demoFn = useServerFn(createDemoConversation);
  const { data: conversations = [], isLoading, isError } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listFn(),
  });

  const demoMutation = useMutation({
    mutationFn: () => demoFn(),
    onSuccess: ({ rideId }) => {
      router.navigate({ to: "/rides/$rideId", params: { rideId } });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Couldn't start demo conversation",
      ),
  });

  const isDev = import.meta.env.DEV;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        {isDev && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => demoMutation.mutate()}
            disabled={demoMutation.isPending}
          >
            {demoMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Demo chat
          </Button>
        )}
      </div>


      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading conversations…
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            Couldn't load conversations. Please try again.
          </CardContent>
        </Card>
      ) : conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <MessageCircle className="size-6" />
            Once a driver accepts your ride, your conversation appears here.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {conversations.map((c) => (
            <Link
              key={c.rideId}
              to="/rides/$rideId"
              params={{ rideId: c.rideId }}
              className="block"
            >
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="flex items-center gap-3 py-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageCircle className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {c.counterpartName ?? "Your ride partner"}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {relativeTime(c.lastMessageAt ?? c.createdAt)}
                      </span>
                    </div>
                    <p
                      className={
                        "truncate text-sm " +
                        (c.unreadCount > 0
                          ? "font-medium text-foreground"
                          : "text-muted-foreground")
                      }
                    >
                      {c.lastMessage ?? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {c.pickupAddress}
                        </span>
                      )}
                    </p>
                    <Badge
                      variant={rideStatusVariant(c.status)}
                      className="w-fit text-[10px]"
                    >
                      {rideStatusLabel(c.status)}
                    </Badge>
                  </div>
                  {c.unreadCount > 0 ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                      {c.unreadCount > 9 ? "9+" : c.unreadCount}
                    </span>
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
