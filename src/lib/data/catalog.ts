import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCatalogProductBySlug, listStorefrontProducts } from "@/lib/catalog/queries";
import type { CatalogMedia, CatalogProduct, CatalogVariant, ProductSpecification } from "@/lib/catalog/types";

export interface ProductCard {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  price: number;
  compare_at_price: number | null;
  images: string[];
  is_featured: boolean;
  stock: number;
  default_variant?: CatalogVariant | null;
  variant_count?: number;
}

export interface ProductDetail extends ProductCard {
  sku: string | null;
  short_desc_en: string;
  short_desc_ar: string;
  long_desc_en: string;
  long_desc_ar: string;
  weight: string | null;
  category_id: string | null;
  brand_id: string | null;
  brand_name_en: string | null;
  brand_name_ar: string | null;
  variants: CatalogVariant[];
  media: CatalogMedia[];
  specifications: ProductSpecification[];
}

function toProductCard(product: CatalogProduct): ProductCard {
  const defaultVariant = product.variants.find((variant) => variant.is_default) ?? product.variants[0] ?? null;
  const lowest = [...product.variants].sort((a, b) => a.base_price - b.base_price)[0] ?? defaultVariant;
  return {
    id: product.id, slug: product.slug, name_en: product.name_en, name_ar: product.name_ar,
    price: lowest?.base_price ?? 0, compare_at_price: lowest?.compare_at_price ?? null,
    images: product.media.map((media) => media.public_url), is_featured: product.is_featured,
    stock: product.variants.reduce((sum, variant) => sum + variant.stock, 0),
    default_variant: defaultVariant, variant_count: product.variants.length,
  };
}

export interface CategoryInfo {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  image: string | null;
}

const STORE_CATEGORY_FALLBACKS: CategoryInfo[] = [
  { id: "", slug: "protein", name_en: "Protein", name_ar: "مكملات بروتين", image: null },
  { id: "", slug: "creatine", name_en: "Creatine", name_ar: "مكملات كرياتين", image: null },
  { id: "", slug: "amino-acids", name_en: "Amino Acids", name_ar: "أحماض أمينية", image: null },
  { id: "", slug: "vitamins", name_en: "Vitamins & Minerals", name_ar: "فيتامينات ومعادن", image: null },
  { id: "", slug: "pre-workout", name_en: "Pre-Workout", name_ar: "مكملات طاقة", image: null },
  { id: "", slug: "mass-gainer", name_en: "Mass Gainer", name_ar: "الماس جينر وزيادة الوزن", image: null },
  { id: "", slug: "fat-burner", name_en: "Fat Burner", name_ar: "حوارق دهون", image: null },
  { id: "", slug: "carbohydrates", name_en: "Carbohydrates", name_ar: "مكملات كربوهيدرات", image: null },
  { id: "", slug: "accessories", name_en: "Accessories", name_ar: "إكسسوارات التمرين", image: null },
  { id: "", slug: "other-products", name_en: "Other Products", name_ar: "منتجات أخرى", image: null },
];

/** Featured + recent active products for the homepage. */
export async function getFeaturedProducts(limit = 8): Promise<ProductCard[]> {
  return (await listStorefrontProducts({ limit })).map(toProductCard);
}

export async function getCategoryBySlug(
  slug: string,
): Promise<CategoryInfo | null> {
  const supabase = await getSupabaseServerClient();
  const fallback = STORE_CATEGORY_FALLBACKS.find((category) => category.slug === slug) ?? null;
  if (!supabase) return fallback;
  const { data } = await supabase
    .from("categories")
    .select("id, slug, name_en, name_ar, image")
    .eq("slug", slug)
    .maybeSingle();
  return (data as CategoryInfo) ?? fallback;
}

export async function getAllCategories(): Promise<CategoryInfo[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("categories")
    .select("id, slug, name_en, name_ar, image")
    .order("sort_order", { ascending: true });
  return (data as CategoryInfo[]) ?? [];
}

export async function getCategoryById(id: string): Promise<CategoryInfo | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("categories")
    .select("id, slug, name_en, name_ar, image")
    .eq("id", id)
    .maybeSingle();
  return (data as CategoryInfo) ?? null;
}

/** Products for a category page (by category slug). */
export async function getProductsByCategory(
  categorySlug: string,
): Promise<ProductCard[]> {
  const category = await getCategoryBySlug(categorySlug);
  if (!category) return [];
  if (!category.id) return [];
  return (await listStorefrontProducts({ categoryId: category.id })).map(toProductCard);
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  const product = await getCatalogProductBySlug(slug);
  if (!product) return null;
  const card = toProductCard(product);
  return {
    ...card, sku: card.default_variant?.sku ?? null,
    short_desc_en: product.short_desc_en, short_desc_ar: product.short_desc_ar,
    long_desc_en: product.long_desc_en, long_desc_ar: product.long_desc_ar,
    weight: null, category_id: product.category_id, brand_id: product.brand_id,
    brand_name_en: product.brand?.name_en ?? null, brand_name_ar: product.brand?.name_ar ?? null,
    variants: product.variants, media: product.media, specifications: product.specifications,
  };
}

/** Related products from the same category, excluding the current one. */
export async function getRelatedProducts(
  product: ProductDetail,
  limit = 4,
): Promise<ProductCard[]> {
  if (!product.category_id) return [];
  return (await listStorefrontProducts({ categoryId: product.category_id, limit: limit + 1 }))
    .filter((item) => item.id !== product.id).slice(0, limit).map(toProductCard);
}

/* ─── Bundle helpers (config stored in settings table as JSON) ─────────────── */

export interface BundleConfig {
  key: string;
  title_en: string;
  title_ar: string;
  desc_en: string;
  desc_ar: string;
  product_ids: string[];
  bundle_price: number;
  image: string;
  active: boolean;
  sort_order: number;
}

export interface ResolvedBundle {
  key: string;
  title_en: string;
  title_ar: string;
  desc_en: string;
  desc_ar: string;
  image: string;
  products: ProductCard[];
  bundlePrice: number;
  originalPrice: number;
}

const DEFAULT_BUNDLES: BundleConfig[] = [];

export async function getBundleConfigs(): Promise<BundleConfig[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return DEFAULT_BUNDLES;

  const { data } = await supabase
    .from("settings")
    .select("value_en")
    .eq("key", "bundles")
    .maybeSingle();

  if (!data?.value_en) return DEFAULT_BUNDLES;

  try {
    const parsed = JSON.parse(data.value_en) as BundleConfig[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // Invalid JSON — fall through to defaults
  }
  return DEFAULT_BUNDLES;
}

export async function resolveBundles(): Promise<ResolvedBundle[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const configs = await getBundleConfigs();
  const catalogProducts = new Map((await listStorefrontProducts()).map((product) => [product.id, toProductCard(product)]));
  const results: ResolvedBundle[] = [];

  for (const config of configs) {
    if (!config.active) continue;

    let products: ProductCard[] = [];

    if (config.product_ids.length > 0) {
      const { data } = await supabase
        .from("products")
        .select("id, slug, name_en, name_ar, price, compare_at_price, images, is_featured, stock")
        .in("id", config.product_ids);
      products = (data ?? []) as ProductCard[];
    } else {
      const fallbackSlugs = ["protein", "creatine", "performance"];
      const slug = fallbackSlugs[Math.min(config.sort_order, fallbackSlugs.length - 1)] ?? fallbackSlugs[0];
      const cat = await getCategoryBySlug(slug);
      if (cat) {
        const { data } = await supabase
          .from("products")
          .select("id, slug, name_en, name_ar, price, compare_at_price, images, is_featured, stock")
          .eq("is_active", true)
          .eq("category_id", cat.id)
          .order("price", { ascending: true })
          .limit(4);
        products = (data ?? []) as ProductCard[];
      }
    }

    products = products.map((product) => catalogProducts.get(product.id)).filter((product): product is ProductCard => Boolean(product));
    if (products.length === 0 || products.some((product) => !product.default_variant)) continue;

    const originalPrice = products.reduce((s, p) => s + Number(p.price), 0);
    results.push({
      key: config.key,
      title_en: config.title_en,
      title_ar: config.title_ar,
      desc_en: config.desc_en,
      desc_ar: config.desc_ar,
      image: config.image,
      products,
      bundlePrice: config.bundle_price,
      originalPrice,
    });
  }

  return results;
}

/** Get the cheapest active product in a category (for order bump). */
export async function getCheapestInCategory(
  categorySlug: string,
): Promise<ProductCard | null> {
  const category = await getCategoryBySlug(categorySlug);
  if (!category) return null;
  const products = (await listStorefrontProducts({ categoryId: category.id })).map(toProductCard)
    .filter((product) => product.stock > 0)
    .sort((a, b) => a.price - b.price);
  return products[0] ?? null;
}

/* ─── Checkout settings (editable from admin Customize page) ─────────────── */

export interface CheckoutSettings {
  freeShippingThreshold: number;
  bumpProductSlugs: string[];
  bumpPrice: number;
  bumpDesc_en?: string;
  bumpDesc_ar?: string;
}

const DEFAULT_CHECKOUT_SETTINGS: CheckoutSettings = {
  freeShippingThreshold: 600,
  bumpProductSlugs: [],
  bumpPrice: 280,
};

function parsePositiveNumber(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSlugList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((slug) => String(slug).trim())
        .filter(Boolean)
        .slice(0, 3);
    }
  } catch {
    // Comma-separated values are accepted for easy manual edits.
  }
  return value
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function parseImageList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed
        .map((src) => String(src).trim())
        .filter(Boolean)
        .slice(0, 12);
    }
  } catch {
    // Comma/newline-separated values are accepted for easy manual edits.
  }
  return value
    .split(/[\n,]/)
    .map((src) => src.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export async function getCheckoutSettings(): Promise<CheckoutSettings> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return DEFAULT_CHECKOUT_SETTINGS;

  const { data } = await supabase
    .from("settings")
    .select("key, value_en, value_ar")
    .in("key", [
      "free_shipping_threshold",
      "order_bump_product_slugs",
      "order_bump_product_slug",
      "order_bump_price",
      "order_bump_desc",
    ]);

  if (!data || data.length === 0) return DEFAULT_CHECKOUT_SETTINGS;

  const map = new Map(data.map((d) => [d.key, { en: d.value_en, ar: d.value_ar }]));
  const threshold = map.get("free_shipping_threshold")?.en;
  const bumpPrice = map.get("order_bump_price")?.en;
  const bumpSlugs = parseSlugList(
    map.get("order_bump_product_slugs")?.en ||
      map.get("order_bump_product_slug")?.en,
  );
  const bumpDesc = map.get("order_bump_desc");

  return {
    freeShippingThreshold: parsePositiveNumber(
      threshold,
      DEFAULT_CHECKOUT_SETTINGS.freeShippingThreshold,
    ),
    bumpProductSlugs: bumpSlugs,
    bumpPrice: parsePositiveNumber(bumpPrice, DEFAULT_CHECKOUT_SETTINGS.bumpPrice),
    bumpDesc_en: bumpDesc?.en || undefined,
    bumpDesc_ar: bumpDesc?.ar || undefined,
  };
}

/* ─── Hero overrides (editable from admin Customize page) ─────────────────── */

export interface HeroOverrides {
  slides?: HeroSlide[];
  background_image?: string;
  product_images?: string[];
  title_en?: string;
  title_ar?: string;
  subtitle_en?: string;
  subtitle_ar?: string;
  cta_en?: string;
  cta_ar?: string;
  pill_cod_en?: string;
  pill_cod_ar?: string;
  pill_returns_en?: string;
  pill_returns_ar?: string;
  pill_shipping_en?: string;
  pill_shipping_ar?: string;
  marquee_cod_en?: string;
  marquee_cod_ar?: string;
  marquee_returns_en?: string;
  marquee_returns_ar?: string;
  marquee_made_en?: string;
  marquee_made_ar?: string;
  marquee_shipping_en?: string;
  marquee_shipping_ar?: string;
  marquee_payments_en?: string;
  marquee_payments_ar?: string;
}

export interface HeroSlide {
  image: string;
  eyebrow_en?: string;
  eyebrow_ar?: string;
  title_en?: string;
  title_ar?: string;
  subtitle_en?: string;
  subtitle_ar?: string;
  cta_en?: string;
  cta_ar?: string;
  href?: string;
}

function parseHeroSlides(value: string | null | undefined): HeroSlide[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const slides = (parsed as unknown[]).map((slide): HeroSlide | null => {
        if (!slide || typeof slide !== "object") return null;
        const record = slide as Record<string, unknown>;
        return {
          image: String(record.image ?? "").trim(),
          eyebrow_en: String(record.eyebrow_en ?? "").trim() || undefined,
          eyebrow_ar: String(record.eyebrow_ar ?? "").trim() || undefined,
          title_en: String(record.title_en ?? "").trim() || undefined,
          title_ar: String(record.title_ar ?? "").trim() || undefined,
          subtitle_en: String(record.subtitle_en ?? "").trim() || undefined,
          subtitle_ar: String(record.subtitle_ar ?? "").trim() || undefined,
          cta_en: String(record.cta_en ?? "").trim() || undefined,
          cta_ar: String(record.cta_ar ?? "").trim() || undefined,
          href: String(record.href ?? "").trim() || undefined,
        };
      })
      .filter((slide): slide is HeroSlide => Boolean(slide?.image))
      .slice(0, 8);
    return slides;
  } catch {
    return [];
  }
}

export async function getHeroOverrides(): Promise<HeroOverrides> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return {};

  const keys = [
    "hero_slides",
    "hero_background_image", "hero_images",
    "hero_title", "hero_subtitle", "hero_cta",
    "hero_pill_cod", "hero_pill_returns", "hero_pill_shipping",
    "hero_marquee_cod", "hero_marquee_returns", "hero_marquee_made",
    "hero_marquee_shipping", "hero_marquee_payments",
  ];
  const { data } = await supabase
    .from("settings")
    .select("key, value_en, value_ar")
    .in("key", keys);

  if (!data || data.length === 0) return {};

  const map = new Map(data.map((d) => [d.key, { en: d.value_en, ar: d.value_ar }]));
  const g = (k: string) => map.get(k);

  return {
    slides: parseHeroSlides(g("hero_slides")?.en),
    background_image: g("hero_background_image")?.en || undefined,
    product_images: parseImageList(g("hero_images")?.en),
    title_en: g("hero_title")?.en || undefined,
    title_ar: g("hero_title")?.ar || undefined,
    subtitle_en: g("hero_subtitle")?.en || undefined,
    subtitle_ar: g("hero_subtitle")?.ar || undefined,
    cta_en: g("hero_cta")?.en || undefined,
    cta_ar: g("hero_cta")?.ar || undefined,
    pill_cod_en: g("hero_pill_cod")?.en || undefined,
    pill_cod_ar: g("hero_pill_cod")?.ar || undefined,
    pill_returns_en: g("hero_pill_returns")?.en || undefined,
    pill_returns_ar: g("hero_pill_returns")?.ar || undefined,
    pill_shipping_en: g("hero_pill_shipping")?.en || undefined,
    pill_shipping_ar: g("hero_pill_shipping")?.ar || undefined,
    marquee_cod_en: g("hero_marquee_cod")?.en || undefined,
    marquee_cod_ar: g("hero_marquee_cod")?.ar || undefined,
    marquee_returns_en: g("hero_marquee_returns")?.en || undefined,
    marquee_returns_ar: g("hero_marquee_returns")?.ar || undefined,
    marquee_made_en: g("hero_marquee_made")?.en || undefined,
    marquee_made_ar: g("hero_marquee_made")?.ar || undefined,
    marquee_shipping_en: g("hero_marquee_shipping")?.en || undefined,
    marquee_shipping_ar: g("hero_marquee_shipping")?.ar || undefined,
    marquee_payments_en: g("hero_marquee_payments")?.en || undefined,
    marquee_payments_ar: g("hero_marquee_payments")?.ar || undefined,
  };
}

/* ─── Social proof stats ─────────────────────────────────────────────────── */

export interface SocialStats {
  customers: string;
  carWashes: string;
  rating: string;
}

const DEFAULT_STATS: SocialStats = {
  customers: "+500",
  carWashes: "+50",
  rating: "4.8/5",
};

/**
 * Load social proof stats from the settings table.
 * Keys: stat_customers, stat_carwashes, stat_rating.
 * Falls back to hardcoded defaults if settings aren't found.
 */
export async function getSocialStats(): Promise<SocialStats> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return DEFAULT_STATS;

  const { data } = await supabase
    .from("settings")
    .select("key, value_en")
    .in("key", ["stat_customers", "stat_carwashes", "stat_rating"]);

  if (!data || data.length === 0) return DEFAULT_STATS;

  const map = new Map(data.map((d) => [d.key, d.value_en]));
  return {
    customers: map.get("stat_customers") || DEFAULT_STATS.customers,
    carWashes: map.get("stat_carwashes") || DEFAULT_STATS.carWashes,
    rating: map.get("stat_rating") || DEFAULT_STATS.rating,
  };
}

/** Lightweight search across the active catalog. */
export async function searchProducts(query: string): Promise<ProductCard[]> {
  if (!query.trim()) return [];
  return (await listStorefrontProducts({ query, limit: 20 })).map(toProductCard);
}
