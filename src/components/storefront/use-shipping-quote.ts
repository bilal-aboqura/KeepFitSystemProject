"use client";

import { useEffect, useState } from "react";

export function useShippingQuote(governorate: string, city: string, products: string) {
  const key = JSON.stringify([governorate, city, products]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string; attempt: number; cost: number | null; offer: boolean; failed: boolean;
  } | null>(null);

  useEffect(() => {
    if (!governorate || !city || !products) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    const params = new URLSearchParams({ governorate, city, products });
    fetch(`/api/shipping?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const quote = await response.json();
        if (!response.ok || typeof quote.cost !== "number" || !Number.isFinite(quote.cost) || quote.cost < 0) {
          throw new Error("Invalid shipping quote");
        }
        if (active) setResult({ key, attempt, cost: quote.cost, offer: quote.matched === "450ml", failed: false });
      })
      .catch(() => {
        if (active) setResult({ key, attempt, cost: null, offer: false, failed: true });
      })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [governorate, city, products, key, attempt]);

  const current = result?.key === key && result.attempt === attempt ? result : null;
  return {
    shipping: current?.cost ?? null,
    shippingLoading: Boolean(governorate && city && products && !current),
    shippingError: current?.failed ?? false,
    shippingOffer: current?.offer ?? false,
    retryShipping: () => setAttempt((value) => value + 1),
  };
}
