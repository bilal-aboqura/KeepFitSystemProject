import "server-only";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import type { CatalogMedia, CatalogProduct, CatalogVariant } from "./types";
import { catalogDatabaseError } from "./errors";

const productProjection = `
  id,slug,category_id,brand_id,name_en,name_ar,short_desc_en,short_desc_ar,long_desc_en,long_desc_ar,
  is_active,is_featured,seo_title_en,seo_title_ar,seo_description_en,seo_description_ar,images,
  category:categories(id,slug,name_en,name_ar,image,parent_id,is_active,sort_order),
  brand:brands(id,slug,name_en,name_ar,description_en,description_ar,logo_media_id,is_active),
  variants:product_variants(id,product_id,sku,barcode,label_en,label_ar,base_price,compare_at_price,stock,is_default,is_active,archived_at,combination_fingerprint,
    attributes:variant_attribute_values(attribute_definition_id,attribute_value_id,text_value,number_value,boolean_value,
      definition:attribute_definitions(id,code,label_en,label_ar,value_type,unit,is_variant_defining,is_filterable,is_visible,is_active,sort_order),
      value:attribute_values(id,attribute_definition_id,code,label_en,label_ar,sort_order,is_active)),
    variant_media(sort_order,archived_at,media:catalog_media(id,provider,object_key,mime_type,byte_size,width,height,alt_en,alt_ar,archived_at))),
  specifications:product_specifications(id,product_id,attribute_definition_id,attribute_value_id,text_value,number_value,boolean_value,sort_order,
    definition:attribute_definitions(id,code,label_en,label_ar,value_type,unit,is_variant_defining,is_filterable,is_visible,is_active,sort_order),
    value:attribute_values(id,attribute_definition_id,code,label_en,label_ar,sort_order,is_active)),
  product_media(sort_order,is_primary,archived_at,media:catalog_media(id,provider,object_key,mime_type,byte_size,width,height,alt_en,alt_ar,archived_at))`;

function mediaUrl(provider: string, objectKey: string) {
  if (provider === "legacy" || /^https?:\/\//.test(objectKey) || objectKey.startsWith("/")) return objectKey;
  const base = process.env.NEXT_PUBLIC_R2_MEDIA_BASE_URL?.replace(/\/$/, "");
  return base ? `${base}/${objectKey.split("/").map(encodeURIComponent).join("/")}` : "";
}

function mapMedia(row: Record<string, unknown>, relation: Record<string, unknown>): CatalogMedia | null {
  if (!row || row.archived_at) return null;
  const objectKey = String(row.object_key ?? "");
  const publicUrl = mediaUrl(String(row.provider), objectKey);
  if (!publicUrl) return null;
  return {
    id: String(row.id), provider: row.provider as "r2" | "legacy", object_key: objectKey,
    mime_type: String(row.mime_type), byte_size: Number(row.byte_size), width: Number(row.width), height: Number(row.height),
    alt_en: String(row.alt_en ?? ""), alt_ar: String(row.alt_ar ?? ""), public_url: publicUrl,
    sort_order: Number(relation.sort_order ?? 0), is_primary: Boolean(relation.is_primary), archived_at: null,
  };
}

function normalizeProduct(row: Record<string, unknown>): CatalogProduct {
  const legacyImages = Array.isArray(row.images) ? row.images.map(String) : [];
  const productMedia = ((row.product_media as Record<string, unknown>[] | null) ?? [])
    .map((relation) => mapMedia(relation.media as Record<string, unknown>, relation)).filter((item): item is CatalogMedia => Boolean(item))
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  if (productMedia.length === 0) {
    productMedia.push(...legacyImages.map((url, index) => ({
      id: `legacy-${index}`, provider: "legacy" as const, object_key: url, mime_type: "image/webp", byte_size: 1,
      width: 800, height: 800, alt_en: String(row.name_en), alt_ar: String(row.name_ar), public_url: url,
      sort_order: index, is_primary: index === 0, archived_at: null,
    })));
  }
  const variants = ((row.variants as Record<string, unknown>[] | null) ?? []).map((variant) => {
    const media = ((variant.variant_media as Record<string, unknown>[] | null) ?? [])
      .map((relation) => mapMedia(relation.media as Record<string, unknown>, relation)).filter((item): item is CatalogMedia => Boolean(item))
      .sort((a, b) => a.sort_order - b.sort_order);
    return { ...variant, base_price: Number(variant.base_price), compare_at_price: variant.compare_at_price === null ? null : Number(variant.compare_at_price), stock: Number(variant.stock), media } as unknown as CatalogVariant;
  });
  return { ...row, media: productMedia, variants, specifications: (row.specifications ?? []) as CatalogProduct["specifications"] } as unknown as CatalogProduct;
}

export async function listStorefrontProducts(options: { categoryId?: string; featured?: boolean; query?: string; limit?: number } = {}) {
  const db = await getSupabaseServerClient();
  if (!db) return [];
  let query = db.from("products").select(productProjection).eq("is_active", true).is("archived_at", null)
    .eq("product_variants.is_active", true).is("product_variants.archived_at", null).order("is_featured", { ascending: false }).order("created_at", { ascending: false });
  if (options.categoryId) query = query.eq("category_id", options.categoryId);
  if (options.featured) query = query.eq("is_featured", true);
  if (options.query?.trim()) {
    const safe = options.query.trim().replace(/[%_,()]/g, " ").slice(0, 100);
    const [{ data: variantRows }, { data: brandRows }] = await Promise.all([
      db.from("product_variants").select("product_id").or(`sku.ilike.%${safe}%,barcode.ilike.%${safe}%`).eq("is_active", true),
      db.from("brands").select("id").or(`name_en.ilike.%${safe}%,name_ar.ilike.%${safe}%`).eq("is_active", true),
    ]);
    const productIds = [...new Set((variantRows ?? []).map((item) => item.product_id))];
    const brandIds = (brandRows ?? []).map((item) => item.id);
    query = query.or(`name_en.ilike.%${safe}%,name_ar.ilike.%${safe}%,id.in.(${productIds.join(",") || "00000000-0000-0000-0000-000000000000"}),brand_id.in.(${brandIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
  }
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) { console.error("listStorefrontProducts:", error.message); return []; }
  return (data ?? []).map((row) => normalizeProduct(row as unknown as Record<string, unknown>)).filter((product) => product.variants.length > 0);
}

export async function getCatalogProductBySlug(slug: string) {
  const db = await getSupabaseServerClient();
  if (!db) return null;
  const { data, error } = await db.from("products").select(productProjection).eq("slug", slug).eq("is_active", true).is("archived_at", null)
    .eq("product_variants.is_active", true).is("product_variants.archived_at", null).maybeSingle();
  if (error) { console.error("getCatalogProductBySlug:", error.message); return null; }
  if (!data) return null;
  const product = normalizeProduct(data as unknown as Record<string, unknown>);
  return product.variants.length ? product : null;
}

export function defaultCatalogVariant(product: CatalogProduct) {
  return product.variants.find((variant) => variant.is_default) ?? product.variants[0] ?? null;
}

export async function adminCatalogSearch(filters: { query?: string; brandId?: string; categoryId?: string; status?: "active" | "archived" | "all" } = {}) {
  const db = getSupabaseServiceClient();
  if (!db) return [];
  let query = db.from("products").select(productProjection).order("created_at", { ascending: false });
  if (filters.brandId) query = query.eq("brand_id", filters.brandId);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.status === "active") query = query.eq("is_active", true).is("archived_at", null);
  if (filters.status === "archived") query = query.not("archived_at", "is", null);
  if (filters.query?.trim()) {
    const safe = filters.query.trim().replace(/[%_,()]/g, " ").slice(0, 100);
    const [{ data: variantRows }, { data: brandRows }, { data: categoryRows }] = await Promise.all([
      db.from("product_variants").select("product_id").or(`sku.ilike.%${safe}%,barcode.ilike.%${safe}%`),
      db.from("brands").select("id").or(`name_en.ilike.%${safe}%,name_ar.ilike.%${safe}%`),
      db.from("categories").select("id").or(`name_en.ilike.%${safe}%,name_ar.ilike.%${safe}%`),
    ]);
    const productIds = [...new Set((variantRows ?? []).map((item) => item.product_id))];
    const brandIds = (brandRows ?? []).map((item) => item.id);
    const categoryIds = (categoryRows ?? []).map((item) => item.id);
    query = query.or(`name_en.ilike.%${safe}%,name_ar.ilike.%${safe}%,id.in.(${productIds.join(",") || "00000000-0000-0000-0000-000000000000"}),brand_id.in.(${brandIds.join(",") || "00000000-0000-0000-0000-000000000000"}),category_id.in.(${categoryIds.join(",") || "00000000-0000-0000-0000-000000000000"})`);
  }
  const { data, error } = await query;
  if (error) throw catalogDatabaseError(error);
  return (data ?? []).map((row) => normalizeProduct(row as unknown as Record<string, unknown>));
}
