"use client";

import { useCartCount } from "@/lib/cart";

export function CartCounter() {
  const count = useCartCount();
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand text-[10px] font-bold leading-none text-white shadow-lg shadow-brand/30">
      {count > 99 ? "99+" : count}
    </span>
  );
}
