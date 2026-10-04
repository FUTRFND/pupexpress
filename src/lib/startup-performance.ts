export type StartupMilestone =
  | "T0_NATIVE_LAUNCH"
  | "T1_CAPACITOR_READY"
  | "T2_HTML_VISIBLE"
  | "T3_JAVASCRIPT_READY"
  | "T4_SUPABASE_READY"
  | "T5_LOCAL_SESSION_START"
  | "T6_LOCAL_SESSION_COMPLETE"
  | "T7_REMOTE_VALIDATION_START"
  | "T8_REMOTE_VALIDATION_COMPLETE"
  | "T9_ROUTE_DECISION"
  | "T10_FIRST_SCREEN"
  | "T11_INTERACTIVE";

export type StartupTiming = {
  milestone: StartupMilestone;
  milliseconds: number;
  detail?: string;
};

declare global {
  interface Window {
    __PUPX_STARTUP__?: StartupTiming[];
  }
}

export function markStartup(milestone: StartupMilestone, detail?: string): void {
  if (typeof window === "undefined" || typeof performance === "undefined") return;
  const timeline = (window.__PUPX_STARTUP__ ??= []);
  const existing = timeline.find((item) => item.milestone === milestone);
  // Startup milestones represent the first time each stage becomes available.
  // React Strict Mode and later screen transitions must not overwrite them.
  if (existing) return;
  const entry = {
    milestone,
    milliseconds: Math.round(performance.now()),
    ...(detail ? { detail } : {}),
  };
  timeline.push(entry);
  try {
    sessionStorage.setItem("pupx.startup.last", JSON.stringify(timeline));
  } catch {
    // Timing diagnostics must never interfere with startup.
  }
  if (import.meta.env.DEV) {
    console.debug(`[startup] ${milestone} ${entry.milliseconds}ms${detail ? ` (${detail})` : ""}`);
  }
}

export function markInteractive(detail?: string): void {
  if (typeof window === "undefined") return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => markStartup("T11_INTERACTIVE", detail));
  });
}
