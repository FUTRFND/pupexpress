import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Home, Car, MessageCircle, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getUnreadMessageCount } from "@/lib/ride-detail.functions";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/trips", label: "Trips", icon: Car },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
] as const;

/** Live count of unread messages, refreshed via realtime message inserts. */
function useUnreadMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const countFn = useServerFn(getUnreadMessageCount);

  const { data } = useQuery({
    queryKey: ["unread-messages"],
    // Fail soft: during sign-out the session token can be gone before `user`
    // flips to null, so a stray call would 401. Swallow it and show 0.
    queryFn: async () => {
      try {
        return await countFn();
      } catch {
        return { count: 0 };
      }
    },
    enabled: Boolean(user),
    retry: false,
  });

  // RLS limits delivered rows to the user's rides, so any insert is relevant.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return data?.count ?? 0;
}

export function AppTabBar() {
  const unread = useUnreadMessages();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-screen-sm items-stretch justify-around">
        {tabs.map(({ to, label, icon: Icon }) => {
          const showBadge = to === "/messages" && unread > 0;
          return (
            <Link
              key={to}
              to={to}
              className="flex flex-1 flex-col items-center gap-1 py-2 text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon
                      className={cn("h-5 w-5", isActive && "text-primary")}
                      strokeWidth={isActive ? 2.4 : 2}
                    />
                    {showBadge ? (
                      <span className="absolute -right-2 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[11px] font-medium">{label}</span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
