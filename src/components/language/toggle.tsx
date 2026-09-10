"use client";

import { Languages } from "lucide-react";
import { useLang } from "./provider";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, toggle } = useLang();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle language"
      className={`flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium text-fg-dim transition hover:border-brand/40 hover:text-fg ${className}`}
    >
      <Languages size={14} />
      <span className={lang === "en" ? "text-fg" : "opacity-50"}>EN</span>
      <span className="text-border-hover">/</span>
      <span className={lang === "ar" ? "text-fg" : "opacity-50"}>AR</span>
    </button>
  );
}
