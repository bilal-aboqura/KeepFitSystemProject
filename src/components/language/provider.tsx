"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ui, type Lang, type UIDict } from "@/lib/i18n/translations";

interface LanguageContextValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  t: UIDict;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

const STORAGE_KEY = "lang";
const CHANGE_EVENT = "xeemo:lang-change";

function readLang(): Lang {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "ar" ? "ar" : "en";
}



function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function LanguageProvider({ children, initialLang = "en" }: { children: ReactNode, initialLang?: Lang }) {
  const router = useRouter();
  
  const getServerLang = useCallback(() => initialLang, [initialLang]);
  const lang = useSyncExternalStore(subscribe, readLang, getServerLang);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const toggle = useCallback(
    () => setLang(lang === "ar" ? "en" : "ar"),
    [lang, setLang],
  );

  // Reflect language onto <html> for accessibility, fonts, and RTL, and mirror
  // it to a cookie so Server Components can render the right locale too.
  // This effect only updates external systems (the DOM / cookies) — no setState.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    
    // Sync cookie for Server Components
    const currentCookie = document.cookie.match(new RegExp(`(?:^|; )${STORAGE_KEY}=([^;]*)`));
    if (currentCookie?.[1] !== lang) {
      document.cookie = `${STORAGE_KEY}=${lang}; path=/; max-age=31536000; samesite=lax`;
      // Force Server Components to re-fetch with new cookie
      router.refresh();
    }
  }, [lang, router]);

  const value: LanguageContextValue = {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    t: ui[lang],
    setLang,
    toggle,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx)
    throw new Error("useLang must be used within a <LanguageProvider>");
  return ctx;
}
