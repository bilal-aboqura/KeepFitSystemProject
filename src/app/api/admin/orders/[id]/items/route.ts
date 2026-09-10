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
  name_en: string;
  name_ar: string | null;
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
    .select("id, governorate, city, payment_method, discount_code, order_items(id, product_id, name_en, name_ar, price, image)")
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
        name_en: line.name_en,
        name_ar: line.name_ar,
        price: Number(line.price),
        quantity: requested.quantity,
        image: line.image,
      });
      continue;
    }

    const product = requested.product_id ? productMap.get(requested.product_id) : null;
    if (!product) {
      return NextResponse.json({ error: "A selected product no longer exists" }, { status: 422 });
    }
    normalizedItems.push({
      id: null,
      product_id: product.id,
      name_en: product.name_en,
      name_ar: product.name_ar,
      price: Number(product.price),
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
