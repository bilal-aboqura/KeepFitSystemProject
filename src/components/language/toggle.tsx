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
      className={`group flex min-h-11 items-center gap-2 rounded-lg border border-brand/80 bg-brand/10 px-3.5 text-sm font-extrabold text-white transition hover:bg-brand hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${className}`}
    >
      <Languages size={16} strokeWidth={2.4} />
      <span className={lang === "ar" ? "text-brand transition group-hover:text-black" : "text-white/60 transition group-hover:text-black/70"}>AR</span>
      <span className="text-brand/80 transition group-hover:text-black/70">/</span>
      <span className={lang === "en" ? "text-brand transition group-hover:text-black" : "text-white/60 transition group-hover:text-black/70"}>EN</span>
    </button>
  );
}
