import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import type { BundleConfig } from "@/lib/data/catalog";

const BundleSchema = z.object({
  key: z.string(),
  title_en: z.string(),
  title_ar: z.string(),
  desc_en: z.string(),
  desc_ar: z.string(),
  product_ids: z.array(z.string()),
  bundle_price: z.number().nonnegative(),
  image: z.string(),
  active: z.boolean(),
  sort_order: z.number(),
});

const BodySchema = z.object({
  bundles: z.array(BundleSchema),
});

/** GET /api/admin/bundles — returns saved bundle configs + all products */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ bundles: [], products: [] });

  const [{ data: setting }, { data: products }] = await Promise.all([
    sb.from("settings").select("value_en").eq("key", "bundles").maybeSingle(),
    sb.from("products").select("id, name_en, name_ar, price, images").order("name_en", { ascending: true }),
  ]);

  let bundles: BundleConfig[] = [];
  if (setting?.value_en) {
    try {
      const parsed = JSON.parse(setting.value_en);
      if (Array.isArray(parsed)) bundles = parsed;
    } catch {
      // invalid JSON
    }
  }

  // If no saved bundles, return defaults
  if (bundles.length === 0) {
    bundles = [
      { key: "fullCare", title_en: "Full Care Package", title_ar: "باكدج العناية الكاملة", desc_en: "Dashboard Shiner + Snow Foam + Tire Shiner + Interior Cleaner (all 1L)", desc_ar: "داشبورد شاينر + سنو فوم + تاير شاينر + منظف داخلي (كلهم 1 لتر)", product_ids: [], bundle_price: 470, image: "/images/gold_1l.webp", active: true, sort_order: 0 },
      { key: "proPack", title_en: "Car Wash Pro Pack", title_ar: "باكدج المغسلة", desc_en: "Dashboard Shiner + Snow Foam + Tire Shiner (all 4kg)", desc_ar: "داشبورد شاينر + سنو فوم + تاير شاينر (كلهم 4 كجم)", product_ids: [], bundle_price: 950, image: "/images/foam4k.webp", active: true, sort_order: 1 },
      { key: "motoPack", title_en: "Moto Complete Pack", title_ar: "باكدج الموتوسيكل الكامل", desc_en: "Dashboard Shiner + Engine Shiner + Foam + Tire Shiner for motorcycles", desc_ar: "داشبورد شاينر + إنجين شاينر + فوم + تاير شاينر للموتوسيكلات", product_ids: [], bundle_price: 450, image: "/images/tire-1l.webp", active: true, sort_order: 2 },
    ];
  }

  return NextResponse.json({ bundles, products: products ?? [] });
}

/** PUT /api/admin/bundles — save all bundle configs */
export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 });
  }

  const jsonStr = JSON.stringify(parsed.data.bundles);
  const { error } = await sb
    .from("settings")
    .upsert({ key: "bundles", value_en: jsonStr, value_ar: jsonStr }, { onConflict: "key" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
