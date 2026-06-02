import { Link } from "@tanstack/react-router";
import { Home, Car, MessageCircle, User } from "lucide-react";

import { cn } from "@/lib/utils";

const tabs = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/trips", label: "Trips", icon: Car },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppTabBar() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-screen-sm items-stretch justify-around">
        {tabs.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-1 flex-col items-center gap-1 py-2 text-muted-foreground transition-colors"
            activeProps={{ className: "text-primary" }}
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn("h-5 w-5", isActive && "text-primary")}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <span className="text-[11px] font-medium">{label}</span>
              </>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
