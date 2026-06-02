import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Bell,
  Loader2,
  Car,
  MessageCircle,
  Star,
  CheckCheck,
} from "lucide-react";

import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationDTO,
} from "@/lib/notifications.functions";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function relativeTime(at: string): string {
  const diff = Date.now() - new Date(at).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(at).toLocaleDateString();
}

function iconFor(type: string | null) {
  if (type === "message") return MessageCircle;
  if (type === "rating") return Star;
  if (type === "ride") return Car;
  return Bell;
}

function NotificationsPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const hasUnread = items.some((n) => !n.read_at);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 rounded-full">
          <Link to="/home" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="flex-1 text-2xl font-bold tracking-tight">Notifications</h1>
        {hasUnread ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            Couldn't load notifications. Please try again.
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <Bell className="size-6" />
            You're all caught up. Notifications about your rides appear here.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onOpen={() => {
                if (!n.read_at) markRead.mutate(n.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  n,
  onOpen,
}: {
  n: NotificationDTO;
  onOpen: () => void;
}) {
  const Icon = iconFor(n.type);
  const unread = !n.read_at;

  const inner = (
    <CardContent className="flex items-start gap-3 py-3">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          unread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-sm", unread && "font-semibold")}>
            {n.title}
          </p>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {relativeTime(n.created_at)}
          </span>
        </div>
        {n.body ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {n.body}
          </p>
        ) : null}
      </div>
      {unread ? (
        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
      ) : null}
    </CardContent>
  );

  if (n.ride_id) {
    return (
      <Card className="transition-colors hover:bg-accent/50">
        <Link
          to="/rides/$rideId"
          params={{ rideId: n.ride_id }}
          onClick={onOpen}
          className="block"
        >
          {inner}
        </Link>
      </Card>
    );
  }

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50"
      onClick={onOpen}
    >
      {inner}
    </Card>
  );
}
