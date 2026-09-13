"use client";

import { useSyncExternalStore } from "react";

export interface CartItem {
  intent_version?: 2;
  intent_status?: "ready" | "legacy_selection_required" | "unavailable";
  id: string;
  variant_id?: string;
  sellable_unit_id?: string;
  product_id?: string;
  sku?: string;
  unit_code?: string | null;
  unit_label_en?: string;
  unit_label_ar?: string;
  base_quantity_num?: number;
  base_quantity_den?: number;
  slug: string;
  name_en: string;
  name_ar: string;
  price: number;
  price_minor?: string;
  price_currency?: "EGP";
  price_status?: "current" | "changed" | "unavailable";
  image: string;
  quantity: number;
  stock?: number;
  variant_label_en?: string;
  variant_label_ar?: string;
  offer_key?: string;
}

const KEY = "cart";
const EVENT = "cart:updated";
export const CART_ITEM_ADDED_EVENT = "cart:item-added";

// ── Store: keeps localStorage as the source of truth ────────────────────────
function readAll(): CartItem[] {
  if (typeof window === "undefined") return [];
  return parseCartStorage(localStorage.getItem(KEY));
}

function commit(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT));
}

// ── useSyncExternalStore glue (stable references, keyed by the raw string) ──
let lastRaw: string | null | undefined;
let lastItems: CartItem[] = [];

function getSnapshot(): CartItem[] {
  const raw =
    typeof window === "undefined" ? undefined : localStorage.getItem(KEY);
  if (raw !== lastRaw) {
    lastRaw = raw;
    try {
      lastItems = parseCartStorage(raw);
    } catch {
      lastItems = [];
    }
  }
  return lastItems;
}

const EMPTY: CartItem[] = [];
function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** React hook returning the current cart items (reactive to changes). */
export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useCartCount(): number {
  return useCart().reduce((sum, i) => sum + i.quantity, 0);
}

// ── Mutations ───────────────────────────────────────────────────────────────
export function addToCart(
  item: Omit<CartItem, "quantity">,
  quantity = 1,
  options: { showPrompt?: boolean } = {},
): void {
  const items = readAll();
  const identity = item.variant_id && item.sellable_unit_id
    ? `${item.variant_id}:${item.sellable_unit_id}`
    : item.id;
  const existing = items.find((candidate) => {
    const candidateIdentity = candidate.variant_id && candidate.sellable_unit_id
      ? `${candidate.variant_id}:${candidate.sellable_unit_id}`
      : candidate.id;
    return candidateIdentity === identity;
  });
  const cap = item.stock ?? 99;
  if (cap <= 0 || quantity <= 0) return;
  const previousQuantity = existing?.quantity ?? 0;
  if (existing) {
    const merged = checkedCartQuantity((existing.quantity || 0), quantity);
    existing.quantity = Math.min(merged, cap);
  } else {
    items.push({ ...item, id: identity, intent_version: 2, intent_status: item.variant_id && item.sellable_unit_id ? "ready" : "legacy_selection_required", quantity: Math.min(quantity, cap) });
  }
  commit(items);
  if (Math.min(previousQuantity + quantity, cap) > previousQuantity && options.showPrompt !== false && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CART_ITEM_ADDED_EVENT));
  }
}

function checkedCartQuantity(current: number, added: number) {
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(added) || current < 0 || added <= 0) {
    throw new RangeError("Cart quantity is outside the supported range.");
  }
  const next = current + added;
  if (!Number.isSafeInteger(next)) throw new RangeError("Cart quantity is outside the supported range.");
  return next;
}

export function mergeCartIntent(items: CartItem[], item: CartItem): CartItem[] {
  const copy = items.map((candidate) => ({ ...candidate }));
  const identity = item.variant_id && item.sellable_unit_id ? `${item.variant_id}:${item.sellable_unit_id}` : item.id;
  const existing = copy.find((candidate) => {
    const candidateIdentity = candidate.variant_id && candidate.sellable_unit_id ? `${candidate.variant_id}:${candidate.sellable_unit_id}` : candidate.id;
    return candidateIdentity === identity;
  });
  if (existing) existing.quantity = checkedCartQuantity(existing.quantity, item.quantity);
  else copy.push({ ...item, id: identity, intent_version: 2, intent_status: item.variant_id && item.sellable_unit_id ? "ready" : "legacy_selection_required" });
  return copy;
}

export function parseCartStorage(raw: string | null | undefined): CartItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const item = value as Partial<CartItem>;
      if (typeof item.id !== "string" || typeof item.slug !== "string" || typeof item.name_en !== "string" || typeof item.name_ar !== "string" || typeof item.image !== "string" || typeof item.price !== "number" || !Number.isSafeInteger(item.quantity) || item.quantity! <= 0) return [];
      const canonical = typeof item.variant_id === "string" && typeof item.sellable_unit_id === "string";
      return [{ ...item, intent_version: canonical ? 2 as const : item.intent_version, intent_status: item.intent_status ?? (canonical ? "ready" as const : "legacy_selection_required" as const) } as CartItem];
    });
  } catch {
    return [];
  }
}

export function migrateUnambiguousLegacyCartItem(
  productId: string,
  variant: Omit<CartItem, "quantity">,
): boolean {
  const items = readAll();
  const legacyIndex = items.findIndex((item) => !item.variant_id && item.id === productId);
  if (legacyIndex < 0 || !variant.variant_id || !variant.sellable_unit_id) return false;
  const legacy = items[legacyIndex];
  items[legacyIndex] = { ...variant, quantity: Math.min(legacy.quantity, variant.stock ?? 99) };
  commit(items);
  return true;
}

export function updateQuantity(id: string, quantity: number): void {
  let items = readAll();
  if (quantity <= 0) {
    items = items.filter((i) => i.id !== id);
  } else {
    items = items.map((i) =>
      i.id === id ? { ...i, quantity: Math.min(quantity, i.stock ?? 99) } : i,
    );
  }
  commit(items);
}

export function removeFromCart(id: string): void {
  commit(readAll().filter((i) => i.id !== id));
}

export function clearCart(): void {
  commit([]);
}

export interface CartRepriceResult {
  variantId: string;
  sellableUnitId: string;
  availability: "priced" | "unavailable";
  amountMinor?: string;
  displayAmount?: string;
}

export function applyCartReprice(results: CartRepriceResult[]) {
  const byTarget = new Map(results.map((result) => [`${result.variantId}:${result.sellableUnitId}`, result]));
  let changed = false;
  const items = readAll().map((item) => {
    if (!item.variant_id || !item.sellable_unit_id) return item;
    const result = byTarget.get(`${item.variant_id}:${item.sellable_unit_id}`);
    if (!result) return item;
    if (result.availability === "unavailable") {
      if (item.price_status !== "unavailable") changed = true;
      return { ...item, price_status: "unavailable" as const };
    }
    const nextPrice = Number(result.displayAmount);
    const priceChanged = item.price_minor !== undefined && item.price_minor !== result.amountMinor;
    if (item.price !== nextPrice || item.price_minor !== result.amountMinor || item.price_status !== (priceChanged ? "changed" : "current")) changed = true;
    return { ...item, price: nextPrice, price_minor: result.amountMinor, price_currency: "EGP" as const, price_status: priceChanged ? "changed" as const : "current" as const };
  });
  if (changed) commit(items);
  return changed;
}

export async function repriceCart(items: CartItem[]) {
  const canonical = items.filter((item) => item.variant_id && item.sellable_unit_id);
  if (canonical.length !== items.length) throw new Error("Cart contains a legacy item");
  const response = await fetch("/api/pricing/reprice", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: canonical.map((item) => ({ variant_id: item.variant_id, sellable_unit_id: item.sellable_unit_id, quantity: item.quantity })) }),
  });
  const body = await response.json();
  if (!response.ok && response.status !== 409) throw new Error("Cart pricing is unavailable");
  return applyCartReprice(body.items ?? []);
}
