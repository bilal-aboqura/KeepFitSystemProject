"use client";

import { useSyncExternalStore } from "react";

export interface CartItem {
  id: string;
  variant_id?: string;
  product_id?: string;
  sku?: string;
  slug: string;
  name_en: string;
  name_ar: string;
  price: number;
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
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
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
      lastItems = raw ? (JSON.parse(raw) as CartItem[]) : [];
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
  const existing = items.find((i) => i.id === item.id);
  const cap = item.stock ?? 99;
  if (cap <= 0 || quantity <= 0) return;
  const previousQuantity = existing?.quantity ?? 0;
  if (existing) {
    existing.quantity = Math.min((existing.quantity || 0) + quantity, cap);
  } else {
    items.push({ ...item, quantity: Math.min(quantity, cap) });
  }
  commit(items);
  if (Math.min(previousQuantity + quantity, cap) > previousQuantity && options.showPrompt !== false && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CART_ITEM_ADDED_EVENT));
  }
}

export function migrateUnambiguousLegacyCartItem(
  productId: string,
  variant: Omit<CartItem, "quantity">,
): boolean {
  const items = readAll();
  const legacyIndex = items.findIndex((item) => !item.variant_id && item.id === productId);
  if (legacyIndex < 0 || !variant.variant_id) return false;
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
