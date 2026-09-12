import "server-only";
import { newConfirmationGrant } from "@/lib/customers/grants";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getCheckoutSettings, resolveBundles } from "@/lib/data/catalog";
import { calcItemsSubtotal, calcOnlinePaymentDiscount } from "@/lib/pricing";
import { is450MlDestination, is450MlProduct } from "@/lib/shipping-policy";
import { resolvePurchasableVariants } from "@/lib/catalog/variants";
import { CatalogError } from "@/lib/catalog/errors";
import { deriveCompatibilityUnitPrice } from "@/lib/pricing";
import { mapPackagingUnit } from "@/lib/catalog/packaging-commands";
import type { CatalogPackagingUnit } from "@/lib/catalog/types";

export interface CreateOrderInput {
  customer_name: string;
  customer_phone: string;
  alt_phone: string;
  governorate: string;
  city: string;
  address: string;
  notes?: string;
  payment_method: "card" | "cod";
  discount_code?: string | null;
  user_id?: string | null;
  customer_id?: string | null;
  items: {
    variant_id?: string;
    sellable_unit_id?: string;
    product_id?: string;
    quantity: number;
    image?: string;
    offer?: "order_bump";
    offer_key?: string;
  }[];
}

export interface CreatedOrder {
  confirmationGrant?: ReturnType<typeof newConfirmationGrant>;
  id: string;
  order_number: string;
  grand_total: number;
  payment_method: string;
}

interface ResolvedOrderVariant {
  id: string;
  product_id: string;
  base_price: number;
  stock: number;
  product: { slug?: string } | { slug?: string }[];
}

interface ResolvedOrderItem {
  variant_id: string;
  sellable_unit_id: string;
  product_id: string;
  price: number;
  quantity: number;
  image?: string;
  offer_key?: string;
  is_default_sale_unit: boolean;
}

/** Generate a short, human-friendly order number like XE-1A2B3C-240624 */
export function generateOrderNumber(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `XE-${rand}-${yy}${mm}${dd}`;
}

export interface ShippingQuote {
  cost: number;
  matched: "exact" | "governorate" | "default" | "450ml";
}

/** Resolve shipping cost: exact (gov,city) → (gov,'*') → ('*','*'). */
export async function getShippingCost(
  governorate: string,
  city: string,
): Promise<ShippingQuote> {
  const sb = getSupabaseServiceClient();
  if (!sb) return { cost: 120, matched: "default" };

  // 1) exact
  let { data, error } = await sb
    .from("shipping_rates")
    .select("cost")
    .eq("governorate", governorate)
    .eq("city", city)
    .maybeSingle();
  if (error) throw error;
  if (data) return { cost: Number(data.cost), matched: "exact" };

  // 2) governorate wildcard
  ({ data, error } = await sb
    .from("shipping_rates")
    .select("cost")
    .eq("governorate", governorate)
    .eq("city", "*")
    .maybeSingle());
  if (error) throw error;
  if (data) return { cost: Number(data.cost), matched: "governorate" };

  // 3) global default
  ({ data, error } = await sb
    .from("shipping_rates")
    .select("cost")
    .eq("governorate", "*")
    .eq("city", "*")
    .maybeSingle());
  if (error) throw error;
  return { cost: Number(data?.cost ?? 120), matched: "default" };
}

export async function getShippingCostForProducts(
  governorate: string,
  city: string,
  productIds: (string | null)[],
): Promise<ShippingQuote> {
  const standardShipping = await getShippingCost(governorate, city);
  if (productIds.some((id) => !id)) return standardShipping;
  const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length || !is450MlDestination(governorate)) {
    return standardShipping;
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return standardShipping;
  const { data, error } = await sb
    .from("products")
    .select("id, weight, name_en, name_ar")
    .in("id", ids);
  if (error) throw error;
  if (!data || data.length !== ids.length) throw new Error("Shipping products not found");
  if (!data.every(is450MlProduct)) {
    return standardShipping;
  }
  return { cost: 80, matched: "450ml" };
}

/** Look up + validate a discount code; returns the discount amount for a subtotal. */
export async function resolveDiscount(
  code: string | null | undefined,
  subtotal: number,
): Promise<{ amount: number; code: string } | null> {
  if (!code) return null;
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data } = await sb
    .from("discounts")
    .select("id, code, type, value, min_subtotal, expires_at, usage_limit, used_count, active")
    .eq("code", code.toUpperCase())
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  if (data.usage_limit && data.used_count >= data.usage_limit) return null;
  if (subtotal < Number(data.min_subtotal ?? 0)) return null;

  let amount = 0;
  if (data.type === "percent") {
    amount = Math.round(subtotal * (Number(data.value) / 100) * 100) / 100;
  } else {
    amount = Math.min(Number(data.value), subtotal);
  }
  return { amount, code: data.code };
}

/**
 * Create an order (with line items + snapshot). Uses the service role.
 * For COD the order is immediately "pending payment / pending fulfillment".
 * For card it stays pending until the Kashier webhook marks it paid.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<CreatedOrder | null> {
  const sb = getSupabaseServiceClient();
  if (!sb || input.items.length === 0) return null;

  const checkoutSettings = await getCheckoutSettings();
  const resolvedItems: ResolvedOrderItem[] = [];
  const explicitIds = input.items.flatMap((item) => item.variant_id ? [item.variant_id] : []);
  const explicitVariants = new Map<string, ResolvedOrderVariant>((await resolvePurchasableVariants(explicitIds)).map((variant) => [variant.id, variant as unknown as ResolvedOrderVariant]));
  const packagingByVariant = new Map<string, CatalogPackagingUnit[]>();
  if (explicitIds.length) {
    const { data, error } = await sb.from("variant_packaging_units")
      .select("id,variant_id,parent_unit_id,code,barcode,label_en,label_ar,quantity_per_parent_num,quantity_per_parent_den,base_quantity_num,base_quantity_den,is_base_unit,is_sellable,is_default_sale_unit,default_price_mode,is_active,archived_at")
      .in("variant_id", [...new Set(explicitIds)]).eq("is_active", true).is("archived_at", null);
    if (error) throw error;
    for (const row of data ?? []) {
      const unit = mapPackagingUnit(row as unknown as Record<string, unknown>);
      packagingByVariant.set(unit.variant_id!, [...(packagingByVariant.get(unit.variant_id!) ?? []), unit]);
    }
  }
  for (const item of input.items) {
    let variant: ResolvedOrderVariant | undefined = item.variant_id ? explicitVariants.get(item.variant_id) : undefined;
    if (!variant && item.product_id && !item.variant_id) {
      const { data } = await sb.from("product_variants")
        .select("id,product_id,base_price,stock,is_active,archived_at,product:products!inner(id,slug,is_active,archived_at)")
        .eq("product_id", item.product_id).eq("is_active", true).is("archived_at", null)
        .eq("product.is_active", true).is("product.archived_at", null).limit(2);
      if (data?.length === 1) variant = data[0] as unknown as ResolvedOrderVariant;
      else throw new CatalogError("This saved cart item has multiple or unavailable options. Choose the product again.", 409, "ambiguous_legacy_cart");
    }
    if (!variant) throw new CatalogError("The selected variant is no longer available.", 409, "inactive_variant");
    let units = packagingByVariant.get(variant.id);
    if (!units) {
      const { data, error } = await sb.from("variant_packaging_units")
        .select("id,variant_id,parent_unit_id,code,barcode,label_en,label_ar,quantity_per_parent_num,quantity_per_parent_den,base_quantity_num,base_quantity_den,is_base_unit,is_sellable,is_default_sale_unit,default_price_mode,is_active,archived_at")
        .eq("variant_id", variant.id).eq("is_active", true).is("archived_at", null);
      if (error) throw error;
      units = (data ?? []).map((row) => mapPackagingUnit(row as unknown as Record<string, unknown>));
      packagingByVariant.set(variant.id, units);
    }
    const defaultUnit = units.find((unit) => unit.is_sellable && unit.is_default_sale_unit);
    const selectedUnit = item.sellable_unit_id
      ? units.find((unit) => unit.id === item.sellable_unit_id && unit.is_sellable)
      : defaultUnit;
    if (!defaultUnit || !selectedUnit) {
      throw new CatalogError("The selected Sellable Unit is no longer available. Choose the product again.", 409, "inactive_sellable_unit");
    }
    if (Number(variant.stock) < item.quantity) throw new CatalogError("The selected quantity is no longer available.", 409, "variant_stock_changed");
    const product = Array.isArray(variant.product) ? variant.product[0] : variant.product;
    const isOrderBump = item.offer === "order_bump" && selectedUnit.is_default_sale_unit && product && checkoutSettings.bumpProductSlugs.includes(String(product.slug));
    const resolvedPrice = isOrderBump
      ? checkoutSettings.bumpPrice
      : deriveCompatibilityUnitPrice(Number(variant.base_price), selectedUnit, defaultUnit);
    resolvedItems.push({ variant_id: variant.id, sellable_unit_id: selectedUnit.id, product_id: variant.product_id, price: resolvedPrice, quantity: item.quantity, image: item.image, offer_key: item.offer_key, is_default_sale_unit: selectedUnit.is_default_sale_unit });
  }

  const bundleKeys = [...new Set(resolvedItems.flatMap((item) => item.offer_key ? [item.offer_key] : []))];
  if (bundleKeys.length) {
    const bundles = new Map((await resolveBundles()).map((bundle) => [bundle.key, bundle]));
    for (const key of bundleKeys) {
      const bundle = bundles.get(key);
      const submitted = resolvedItems.filter((item) => item.offer_key === key);
      const expectedIds = bundle?.products.map((product) => product.id).sort() ?? [];
      const submittedIds = submitted.map((item) => item.product_id).sort();
      if (!bundle || submitted.some((item) => item.quantity !== 1 || !item.is_default_sale_unit) || expectedIds.join("|") !== submittedIds.join("|")) return null;
      const ratio = bundle.originalPrice > 0 ? bundle.bundlePrice / bundle.originalPrice : 1;
      for (const item of submitted) item.price = Math.round(item.price * ratio * 100) / 100;
    }
  }

  const itemsTotal = calcItemsSubtotal(resolvedItems);
  const onlinePaymentDiscount = calcOnlinePaymentDiscount(
    itemsTotal,
    input.payment_method,
  );
  const [shipping] = await Promise.all([
    getShippingCostForProducts(
      input.governorate,
      input.city,
      resolvedItems.map((item) => item.product_id),
    ),
  ]);
  const shippingCost =
    itemsTotal >= checkoutSettings.freeShippingThreshold ? 0 : shipping.cost;
  const codeDiscount = await resolveDiscount(input.discount_code, itemsTotal);
  const totalDiscount = onlinePaymentDiscount + (codeDiscount?.amount ?? 0);
  const grandTotal = Math.max(
    0,
    itemsTotal + shippingCost - totalDiscount,
  );

  const grant = input.customer_id ? undefined : newConfirmationGrant();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await sb.rpc("customer_create_order", {
      p_order: {
        order_number: generateOrderNumber(), user_id: input.user_id ?? null, customer_id: input.customer_id ?? null,
        customer_name: input.customer_name, customer_phone: input.customer_phone, alt_phone: input.alt_phone,
        governorate: input.governorate, city: input.city, address: input.address, notes: input.notes ?? null,
        items_total: itemsTotal, shipping_cost: shippingCost, discount: totalDiscount,
        discount_code: codeDiscount?.code ?? null, grand_total: grandTotal, payment_method: input.payment_method,
      },
      p_items: resolvedItems.map((item) => ({ variant_id: item.variant_id, sellable_unit_id: item.sellable_unit_id, product_id: item.product_id, price: item.price, quantity: item.quantity, image: item.image })), p_grant_hash: grant?.hash ?? null,
    });
    if (!error && data) return { ...data, confirmationGrant: grant } as CreatedOrder;
    if (error?.code !== "23505") return null;
  }
  return null;
}

export interface OrderForConfirmation {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  alt_phone: string | null;
  governorate: string;
  city: string;
  address: string;
  notes: string | null;
  items_total: number;
  shipping_cost: number;
  discount: number;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  fulfillment_status: string;
  created_at: string;
  order_items: {
    id: string;
    product_id: string;
    variant_id: string | null;
    sellable_unit_id: string | null;
    sku: string | null;
    sellable_unit_code: string | null;
    variant_label_en: string | null;
    variant_label_ar: string | null;
    unit_label_en: string | null;
    unit_label_ar: string | null;
    base_quantity_per_unit_num: number | null;
    base_quantity_per_unit_den: number | null;
    equivalent_base_quantity_num: number | null;
    equivalent_base_quantity_den: number | null;
    line_total: number | null;
    name_en: string;
    name_ar: string | null;
    price: number;
    quantity: number;
    image: string | null;
  }[];
}

export async function getOrderByNumber(
  orderNumber: string,
): Promise<OrderForConfirmation | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data } = await sb
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_phone, alt_phone, governorate, city, address, notes, items_total, shipping_cost, discount, grand_total, payment_method, payment_status, fulfillment_status, created_at, order_items(id, product_id, variant_id, sellable_unit_id, sku, sellable_unit_code, name_en, name_ar, variant_label_en, variant_label_ar, unit_label_en, unit_label_ar, base_quantity_per_unit_num, base_quantity_per_unit_den, equivalent_base_quantity_num, equivalent_base_quantity_den, price, line_total, quantity, image)",
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  return (data as OrderForConfirmation) ?? null;
}
