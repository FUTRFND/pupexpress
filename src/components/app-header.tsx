import { useMode } from "@/hooks/use-mode";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { mode, setMode } = useMode();

  return (
    <header
      className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex w-full max-w-screen-sm items-center justify-between gap-3 px-4 py-3">
        <span className="text-lg font-bold tracking-tight text-primary">
          PupXpress
        </span>

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
      </div>
    </header>
  );
}
