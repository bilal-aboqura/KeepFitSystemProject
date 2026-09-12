import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { getCheckoutSettings } from "@/lib/data/catalog";
import { getShippingCostForProducts, resolveDiscount } from "@/lib/data/orders";
import { calcItemsSubtotal, calcOnlinePaymentDiscount } from "@/lib/pricing";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const LineSchema = z.object({
  line_id: z.string().uuid().optional(),
  product_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(999),
});

const BodySchema = z.object({
  items: z.array(LineSchema).min(1).max(100),
});

type ExistingLine = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  sellable_unit_id: string | null;
  sku: string | null;
  sellable_unit_code: string | null;
  name_en: string;
  name_ar: string | null;
  product_name_en: string | null;
  product_name_ar: string | null;
  variant_label_en: string | null;
  variant_label_ar: string | null;
  unit_label_en: string | null;
  unit_label_ar: string | null;
  units_per_sold_package_num: number | null;
  units_per_sold_package_den: number | null;
  base_quantity_per_unit_num: number | null;
  base_quantity_per_unit_den: number | null;
  equivalent_base_quantity_num: number | null;
  equivalent_base_quantity_den: number | null;
  price: number;
  image: string | null;
};

type CatalogProduct = {
  id: string;
  name_en: string;
  name_ar: string;
  price: number;
  images: string[];
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const idResult = z.string().uuid().safeParse(id);
  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!idResult.success || !parsed.success) {
    return NextResponse.json({ error: "Invalid order items" }, { status: 422 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, governorate, city, payment_method, discount_code, order_items(id, product_id, variant_id, sellable_unit_id, sku, sellable_unit_code, name_en, name_ar, product_name_en, product_name_ar, variant_label_en, variant_label_ar, unit_label_en, unit_label_ar, units_per_sold_package_num, units_per_sold_package_den, base_quantity_per_unit_num, base_quantity_per_unit_den, equivalent_base_quantity_num, equivalent_base_quantity_den, price, image)")
    .eq("id", id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const existingLines = new Map(
    ((order.order_items ?? []) as ExistingLine[]).map((line) => [line.id, line]),
  );
  const requestedProductIds = Array.from(
    new Set(
      parsed.data.items
        .filter((line) => !line.line_id && line.product_id)
        .map((line) => line.product_id as string),
    ),
  );
  const { data: products, error: productsError } = requestedProductIds.length
    ? await supabase
        .from("products")
        .select("id, name_en, name_ar, price, images")
        .in("id", requestedProductIds)
    : { data: [] as CatalogProduct[], error: null };
  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 400 });
  }
  const productMap = new Map(
    ((products ?? []) as CatalogProduct[]).map((product) => [product.id, product]),
  );
  const { data: variants, error: variantsError } = requestedProductIds.length
    ? await supabase.from("product_variants")
        .select("id,product_id,sku,label_en,label_ar,base_price")
        .in("product_id", requestedProductIds).eq("is_default", true).eq("is_active", true).is("archived_at", null)
    : { data: [], error: null };
  if (variantsError) return NextResponse.json({ error: variantsError.message }, { status: 400 });
  const variantMap = new Map((variants ?? []).map((variant) => [variant.product_id, variant]));
  const variantIds = (variants ?? []).map((variant) => variant.id);
  const { data: units, error: unitsError } = variantIds.length
    ? await supabase.from("variant_packaging_units")
        .select("id,variant_id,code,label_en,label_ar,quantity_per_parent_num,quantity_per_parent_den,base_quantity_num,base_quantity_den")
        .in("variant_id", variantIds).eq("is_default_sale_unit", true).eq("is_sellable", true).eq("is_active", true).is("archived_at", null)
    : { data: [], error: null };
  if (unitsError) return NextResponse.json({ error: unitsError.message }, { status: 400 });
  const unitMap = new Map((units ?? []).map((unit) => [unit.variant_id, unit]));

  const normalizedItems = [];
  const usedLineIds = new Set<string>();
  for (const requested of parsed.data.items) {
    if (requested.line_id) {
      const line = existingLines.get(requested.line_id);
      if (!line || usedLineIds.has(line.id)) {
        return NextResponse.json({ error: "An order line is invalid or duplicated" }, { status: 422 });
      }
      usedLineIds.add(line.id);
      normalizedItems.push({
        id: line.id,
        product_id: line.product_id,
        variant_id: line.variant_id,
        sellable_unit_id: line.sellable_unit_id,
        sku: line.sku,
        sellable_unit_code: line.sellable_unit_code,
        name_en: line.name_en,
        name_ar: line.name_ar,
        product_name_en: line.product_name_en,
        product_name_ar: line.product_name_ar,
        variant_label_en: line.variant_label_en,
        variant_label_ar: line.variant_label_ar,
        unit_label_en: line.unit_label_en,
        unit_label_ar: line.unit_label_ar,
        units_per_sold_package_num: line.units_per_sold_package_num,
        units_per_sold_package_den: line.units_per_sold_package_den,
        base_quantity_per_unit_num: line.base_quantity_per_unit_num,
        base_quantity_per_unit_den: line.base_quantity_per_unit_den,
        equivalent_base_quantity_num: line.base_quantity_per_unit_num === null ? null : Number(line.base_quantity_per_unit_num) * requested.quantity,
        equivalent_base_quantity_den: line.base_quantity_per_unit_den,
        price: Number(line.price),
        quantity: requested.quantity,
        image: line.image,
      });
      continue;
    }

    const product = requested.product_id ? productMap.get(requested.product_id) : null;
    const variant = product ? variantMap.get(product.id) : null;
    const unit = variant ? unitMap.get(variant.id) : null;
    if (!product || !variant || !unit) {
      return NextResponse.json({ error: "A selected product needs one active default Variant and Sellable Unit" }, { status: 422 });
    }
    normalizedItems.push({
      id: null,
      product_id: product.id,
      variant_id: variant.id,
      sellable_unit_id: unit.id,
      sku: variant.sku,
      sellable_unit_code: unit.code,
      name_en: product.name_en,
      name_ar: product.name_ar,
      product_name_en: product.name_en,
      product_name_ar: product.name_ar,
      variant_label_en: variant.label_en,
      variant_label_ar: variant.label_ar,
      unit_label_en: unit.label_en,
      unit_label_ar: unit.label_ar,
      units_per_sold_package_num: unit.quantity_per_parent_num,
      units_per_sold_package_den: unit.quantity_per_parent_den,
      base_quantity_per_unit_num: unit.base_quantity_num,
      base_quantity_per_unit_den: unit.base_quantity_den,
      equivalent_base_quantity_num: Number(unit.base_quantity_num) * requested.quantity,
      equivalent_base_quantity_den: unit.base_quantity_den,
      price: Number(variant.base_price),
      quantity: requested.quantity,
      image: product.images?.[0] ?? null,
    });
  }

  const itemsTotal = calcItemsSubtotal(normalizedItems);
  const [shippingQuote, checkoutSettings, codeDiscount] = await Promise.all([
    getShippingCostForProducts(order.governorate, order.city, normalizedItems.map((item) => item.product_id)),
    getCheckoutSettings(),
    resolveDiscount(order.discount_code, itemsTotal),
  ]);
  const shippingCost =
    itemsTotal >= checkoutSettings.freeShippingThreshold ? 0 : shippingQuote.cost;
  const onlineDiscount = calcOnlinePaymentDiscount(
    itemsTotal,
    order.payment_method as "card" | "cod",
  );
  const discount = onlineDiscount + (codeDiscount?.amount ?? 0);
  const grandTotal = Math.max(0, itemsTotal + shippingCost - discount);

  const { error } = await supabase.rpc("admin_replace_order_items", {
    p_order_id: id,
    p_items: normalizedItems,
    p_items_total: itemsTotal,
    p_shipping_cost: shippingCost,
    p_discount: discount,
    p_grand_total: grandTotal,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    totals: {
      items_total: itemsTotal,
      shipping_cost: shippingCost,
      discount,
      grand_total: grandTotal,
    },
  });
}
