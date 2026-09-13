import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuoteChangeAlert } from "@/components/storefront/quote-change-alert";
import { CheckoutQuoteReview, type PersistedCheckoutQuote } from "@/components/storefront/checkout-form";
import { StatusBadge } from "@/components/admin/status-badge";

const quote: PersistedCheckoutQuote = {
  quoteId: "10000000-0000-4000-8000-000000000005", revision: 1, state: "draft", currency: "EGP",
  context: { kind: "public", label: "Public" }, lines: [], subtotalMinor: "10000", discounts: [],
  shipping: { amountMinor: "5000", label: "Cairo / Nasr City" }, totalMinor: "15000", validationState: "valid", errors: [],
};

describe("responsive bilingual commerce contracts", () => {
  it.each(["en", "ar"] as const)("keeps review, change, and status messages accessible in %s", (lang) => {
    const change = renderToStaticMarkup(createElement(QuoteChangeAlert, { changes: [{ kind: "shipping_changed" }], lang }));
    const review = renderToStaticMarkup(createElement(CheckoutQuoteReview, { quote, language: lang }));
    const status = renderToStaticMarkup(createElement(StatusBadge, { value: "pending", lang }));
    expect(change).toContain('role="alert"');
    expect(change).toContain('tabindex="-1"');
    expect(review).toContain('aria-live="polite"');
    expect(lang === "ar" ? `${change}${review}${status}` : `${change}${review}${status}`).toContain(lang === "ar" ? "الشحن" : "Shipping");
  });

  it("retains responsive wrapping, compact-grid, and overflow containment at narrow widths", async () => {
    const sources = await Promise.all([
      readFile("src/components/storefront/product-purchase-box.tsx", "utf8"),
      readFile("src/app/(storefront)/cart/page.tsx", "utf8"),
      readFile("src/app/(storefront)/checkout/page.tsx", "utf8"),
      readFile("src/components/admin/quantity-rule-manager.tsx", "utf8"),
      readFile("src/components/admin/orders-table.tsx", "utf8"),
      readFile("src/components/admin/order-snapshot.tsx", "utf8"),
    ]);
    expect(sources.every((source) => /sm:|md:|lg:|xl:/.test(source))).toBe(true);
    expect(sources.slice(3).every((source) => source.includes("overflow-x-auto") || source.includes("flex-wrap") || source.includes("grid"))).toBe(true);
    expect(sources.join("\n")).not.toContain("Xeemo");
  });
});
