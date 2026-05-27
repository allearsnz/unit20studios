const KEY = "u20_source";

/** Persist the first-touch utm_source so it can be attached to a booking. */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const src = new URLSearchParams(window.location.search).get("utm_source");
    if (src && !localStorage.getItem(KEY)) localStorage.setItem(KEY, src.slice(0, 120));
  } catch {
    /* private mode / storage disabled */
  }
}

/** Best-effort attribution source for a booking. */
export function getStoredSource(): string {
  if (typeof window === "undefined") return "direct";
  try {
    return (
      localStorage.getItem(KEY) ||
      new URLSearchParams(window.location.search).get("utm_source") ||
      "direct"
    );
  } catch {
    return "direct";
  }
}
