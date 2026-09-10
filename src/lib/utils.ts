import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Egyptian Pounds. */
export function formatEGP(amount: number, lang: "en" | "ar" = "en") {
  const locale = lang === "ar" ? "ar-EG" : "en-EG";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Egyptian Pounds without symbol — just grouped digits + "EGP" suffix. */
export function formatPrice(amount: number, lang: "en" | "ar" = "en") {
  const digits = new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(
    amount,
  );
  return lang === "ar" ? `${digits} ج.م` : `${digits} EGP`;
}
