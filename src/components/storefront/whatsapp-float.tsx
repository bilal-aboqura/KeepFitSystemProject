"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useLang } from "@/components/language/provider";
import { cn } from "@/lib/utils";

const WA_NUMBER = "201150301033";
const HERO_SELECTOR = "[data-home-hero]";

function isHeroVisible() {
  const hero = document.querySelector(HERO_SELECTOR);
  if (!hero) return false;

  const rect = hero.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

function subscribeToViewport(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  window.addEventListener("resize", callback);
  return () => {
    window.removeEventListener("scroll", callback);
    window.removeEventListener("resize", callback);
  };
}

export function WhatsAppFloat() {
  const { lang } = useLang();
  const pathname = usePathname();
  const ar = lang === "ar";
  const hiddenInHero = useSyncExternalStore(subscribeToViewport, isHeroVisible, () => false);
  const productPage = pathname.startsWith("/product/");
  if (pathname.startsWith("/checkout")) return null;

  return (
    <a
      href={`https://wa.me/${WA_NUMBER}`}
      target="_blank"
      rel="noreferrer"
      aria-label="WhatsApp"
      className={cn(
        "wa-float fixed bottom-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg shadow-black/30 transition-all hover:scale-105 ltr:right-5 rtl:left-5",
        hiddenInHero && "pointer-events-none translate-y-4 opacity-0",
        productPage && "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] sm:bottom-5",
      )}
    >
      <MessageCircle size={22} fill="white" strokeWidth={0} />
      <span className="hidden text-sm font-semibold sm:inline">
        {ar ? "عندك سؤال؟" : "Got a question?"}
      </span>
    </a>
  );
}
