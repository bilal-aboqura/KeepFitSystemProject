"use client";

import { useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/lib/cart";
import type { CommercePublicError, CommerceQuoteProjection } from "@/lib/commerce/types";

interface CartQuoteResult extends CommerceQuoteProjection {
  kind: "cart_quote";
}

export function useCommerceCartQuote(items: CartItem[]) {
  const [quote, setQuote] = useState<CartQuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CommercePublicError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const identity = useMemo(() => items.map((item) => `${item.variant_id}:${item.sellable_unit_id}:${item.quantity}`).join("|"), [items]);
  const hasLegacyItem = items.some((item) => !item.variant_id || !item.sellable_unit_id);

  useEffect(() => {
    if (!identity || hasLegacyItem) return;
    const lines = items.flatMap((item) => item.variant_id && item.sellable_unit_id
      ? [{ variantId: item.variant_id, sellableUnitId: item.sellable_unit_id, quantity: item.quantity }]
      : []);
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) setLoading(true);
      return fetch("/api/commerce/cart-quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines }),
      signal: controller.signal,
      });
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw body.error ?? new Error("Quote unavailable");
      setQuote(body);
      setError(null);
    }).catch((reason) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setQuote(null);
      setError(reason?.code ? reason : { code: "CHECKOUT_UNAVAILABLE", message: "Checkout is temporarily unavailable. Try again.", correlationId: "cart-quote" });
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [attempt, hasLegacyItem, identity, items]);

  const legacyError: CommercePublicError | null = hasLegacyItem
    ? { code: "LEGACY_CART_SELECTION_REQUIRED", message: "Choose a current variant and unit for this saved cart item.", correlationId: "local-cart" }
    : null;
  return { quote: hasLegacyItem ? null : quote, loading: hasLegacyItem ? false : loading, error: legacyError ?? error, retry: () => setAttempt((value) => value + 1) };
}

export function CartQuoteNotice({ loading, error, onRetry }: { loading: boolean; error: CommercePublicError | null; onRetry: () => void }) {
  if (loading) return <p className="rounded-xl border border-border bg-surface p-3 text-sm text-fg-muted" role="status">Checking current price and quantity rules…</p>;
  if (!error) return null;
  return <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert"><p>{error.message}</p><button type="button" onClick={onRetry} className="mt-2 font-semibold underline">Try again</button></div>;
}
