import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type AppMode = "rider" | "driver";

const STORAGE_KEY = "pupxpress.mode";

interface ModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue | undefined>(undefined);

/**
 * Rider / Driver mode, persisted to localStorage so it survives reloads.
 * Client-only state — defaults to "rider" during SSR to avoid mismatch.
 */
export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("rider");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "rider" || stored === "driver") {
      setModeState(stored);
    }
  }, []);

  const setMode = (next: AppMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  };

  const toggleMode = () => setMode(mode === "rider" ? "driver" : "rider");

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used within ModeProvider");
  return ctx;
}
