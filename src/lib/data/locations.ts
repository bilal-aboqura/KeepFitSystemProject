import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface GovernorateOption {
  ar: string;
  en: string;
  cities: string[];
}

/** Group locations into governorate → cities, for the checkout dropdowns. */
export async function getGovernoratesForCheckout(): Promise<GovernorateOption[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("locations")
    .select("governorate_en, governorate_ar, city")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];

  const map = new Map<string, GovernorateOption>();
  for (const row of data) {
    const key = row.governorate_ar;
    if (!map.has(key)) {
      map.set(key, {
        ar: row.governorate_ar,
        en: row.governorate_en,
        cities: [],
      });
    }
    map.get(key)!.cities.push(row.city);
  }
  return Array.from(map.values());
}
