"use client";

export type StoreEvent = "page_view" | "add_to_cart" | "initiate_checkout";

const VISITOR_ID_KEY = "xeemo-visitor-id";

function visitorId(): string | null {
  try {
    const stored = window.localStorage.getItem(VISITOR_ID_KEY);
    if (stored) return stored;

    const id = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export function trackStoreEvent(eventType: StoreEvent, path = window.location.pathname) {
  const id = visitorId();
  if (!id) return;

  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visitorId: id, eventType, path }),
    keepalive: true,
  }).catch(() => undefined);
}
