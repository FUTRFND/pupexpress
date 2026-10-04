const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

function safeRequestLabel(input: RequestInfo | URL): string {
  try {
    const raw = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw, typeof window !== "undefined" ? window.location.origin : undefined);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return "unknown endpoint";
  }
}

function isOnline(): boolean | "unknown" {
  return typeof navigator === "undefined" ? "unknown" : navigator.onLine;
}

/** Bound requests so WebKit cannot surface a generic "Load failed" after ~1 minute. */
export async function boundedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const started = performance.now();
  const label = safeRequestLabel(input);
  const method = init.method ?? (input instanceof Request ? input.method : "GET");
  const upstreamSignal = init.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) abortFromUpstream();
  else upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });
  const timer = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    DEFAULT_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (import.meta.env.DEV) {
      console.debug("[network]", {
        endpoint: label,
        method,
        durationMs: Math.round(performance.now() - started),
        status: response.status,
        online: isOnline(),
      });
    }
    return response;
  } catch (cause) {
    const timedOut = controller.signal.aborted && !upstreamSignal?.aborted;
    if (import.meta.env.DEV) {
      console.warn("[network]", {
        endpoint: label,
        method,
        durationMs: Math.round(performance.now() - started),
        status: null,
        errorClass: cause instanceof Error ? cause.name : typeof cause,
        online: isOnline(),
      });
    }
    throw new Error(
      timedOut
        ? "The server took too long to respond. Check your connection and try again."
        : "The network request failed. Check your connection and try again.",
      { cause },
    );
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
}
