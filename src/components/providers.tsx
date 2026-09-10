"use client";

import type { ReactNode } from "react";
import { LanguageProvider } from "@/components/language/provider";
import type { Lang } from "@/lib/i18n/translations";

/** Client-side providers shared across the whole app. */
export function Providers({ children, initialLang }: { children: ReactNode; initialLang: Lang }) {
  return (
    <LanguageProvider initialLang={initialLang}>{children}</LanguageProvider>
  );
}
