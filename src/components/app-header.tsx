import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";

import { useMode } from "@/hooks/use-mode";
import { getUnreadNotificationCount } from "@/lib/notifications.functions";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { mode, setMode } = useMode();
  const countFn = useServerFn(getUnreadNotificationCount);
  const { data } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => countFn(),
    refetchInterval: 30_000,
  });
  const unread = data?.count ?? 0;

  return (
    <header
      className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex w-full max-w-screen-sm items-center justify-between gap-3 px-4 py-3">
        <span className="text-lg font-bold tracking-tight text-primary">
          PupXpress
        </span>

        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="App mode"
            className="flex items-center rounded-full bg-muted p-1 text-sm"
          >
            {(["rider", "driver"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full px-3 py-1 font-medium capitalize transition-colors",
                  mode === m
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>

          <Link
            to="/notifications"
            aria-label={
              unread > 0 ? `${unread} unread notifications` : "Notifications"
            }
            className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            activeProps={{ className: "text-primary" }}
          >
            <Bell className="size-5" />
            {unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
