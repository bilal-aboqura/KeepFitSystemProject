import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

function slugify(s: string) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ProductSchema = z.object({
  name_en: z.string().min(1),
  name_ar: z.string().min(1),
  slug: z.string().optional(),
  sku: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  price: z.number().nonnegative(),
  compare_at_price: z.number().nullable().optional(),
  stock: z.number().int().min(0),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  images: z.array(z.string()).optional(),
  short_desc_en: z.string().optional(),
  short_desc_ar: z.string().optional(),
  long_desc_en: z.string().optional(),
  long_desc_ar: z.string().optional(),
  weight: z.string().nullable().optional(),
});

/** GET /api/admin/products — list all products (for admin use) */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ products: [] });

  const { data } = await sb
    .from("products")
    .select("id, slug, name_en, name_ar, price, images, stock, is_active")
    .order("name_en", { ascending: true });

  return NextResponse.json({ products: data ?? [] });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const json = await request.json().catch(() => null);
  const parsed = ProductSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 });
  }
  const p = parsed.data;

  const slug = p.slug?.trim() || slugify(p.name_en);
  const body = {
    name_en: p.name_en,
    name_ar: p.name_ar,
    slug,
    sku: p.sku ?? null,
    category_id: p.category_id ?? null,
    price: p.price,
    compare_at_price: p.compare_at_price ?? null,
    stock: p.stock,
    is_active: p.is_active ?? true,
    is_featured: p.is_featured ?? false,
    images: p.images ?? [],
    short_desc_en: p.short_desc_en ?? "",
    short_desc_ar: p.short_desc_ar ?? "",
    long_desc_en: p.long_desc_en ?? "",
    long_desc_ar: p.long_desc_ar ?? "",
    weight: p.weight ?? null,
  };

  const { data, error } = await sb.from("products").insert(body).select("id").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const json = await request.json().catch(() => null);
  const parsed = z
    .object({ id: z.string().uuid(), ...ProductSchema.shape })
    .safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 });
  }
  const { id, ...p } = parsed.data;

  const slug = p.slug?.trim() || slugify(p.name_en);
  const body = {
    name_en: p.name_en,
    name_ar: p.name_ar,
    slug,
    sku: p.sku ?? null,
    category_id: p.category_id ?? null,
    price: p.price,
    compare_at_price: p.compare_at_price ?? null,
    stock: p.stock,
    is_active: p.is_active ?? true,
    is_featured: p.is_featured ?? false,
    images: p.images ?? [],
    short_desc_en: p.short_desc_en ?? "",
    short_desc_ar: p.short_desc_ar ?? "",
    long_desc_en: p.long_desc_en ?? "",
    long_desc_ar: p.long_desc_ar ?? "",
    weight: p.weight ?? null,
  };

  const { error } = await sb.from("products").update(body).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
