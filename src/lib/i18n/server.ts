import { cookies } from "next/headers";
import type { Lang } from "@/lib/i18n/translations";
import { ui } from "@/lib/i18n/translations";

/** Read the current language from the `lang` cookie (set client-side). */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const value = store.get("lang")?.value;
  return value === "ar" ? "ar" : "en";
}

/** Server-side access to the UI dictionary for the current request's locale. */
export async function getT() {
  return ui[await getLang()];
}
