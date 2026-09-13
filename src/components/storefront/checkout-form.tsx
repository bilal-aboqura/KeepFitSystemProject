"use client";

import type { CommerceQuoteProjection } from "@/lib/commerce/types";
import type { CommerceChange } from "@/lib/commerce/types";

export interface PersistedCheckoutQuote extends CommerceQuoteProjection {
  quoteId: string;
  revision: number;
  state: "draft";
}

async function commerceRequest<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error?.message ?? "Checkout is temporarily unavailable.") as Error & { code?: string; quote?: PersistedCheckoutQuote; changes?: CommerceChange[] };
    error.code = result.error?.code;
    error.quote = result.quote;
    error.changes = result.error?.changes;
    throw error;
  }
  return result as T;
}

export function requestCheckoutQuote(body: unknown) {
  return commerceRequest<PersistedCheckoutQuote>("/api/commerce/checkout-quotes", body);
}

export async function confirmAndSubmitCheckout(quote: PersistedCheckoutQuote, submissionId: string) {
  await commerceRequest(`/api/commerce/checkout-quotes/${quote.quoteId}/confirm`, { revision: quote.revision });
  return commerceRequest<{ result: "created"; replayed: boolean; orderNumber: string; redirect: string }>("/api/orders", {
    quoteId: quote.quoteId,
    quoteRevision: quote.revision,
    submissionId,
  });
}

export function CheckoutQuoteReview({ quote, language }: { quote: PersistedCheckoutQuote; language: "en" | "ar" }) {
  const valid = quote.validationState === "valid";
  return (
    <div className={`mt-4 rounded-xl border p-4 text-sm ${valid ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`} role="status" aria-live="polite">
      <p className="font-semibold">{language === "ar" ? "راجع السعر والشحن ثم اضغط مرة ثانية للتأكيد" : "Review the current price and shipping, then press again to confirm"}</p>
      {!valid && quote.errors.map((error) => <p key={`${error.code}:${error.correlationId}`} className="mt-2">{error.message}</p>)}
    </div>
  );
}
