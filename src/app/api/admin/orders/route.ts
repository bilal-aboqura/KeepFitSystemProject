import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendCancelledOrderToMeta } from "@/lib/meta-conversions";
import { listAdminOrders } from "@/lib/data/orders";

const Schema = z.object({
  id: z.string().uuid(),
  notes: z.string().trim().max(5000).nullable().optional(),
  payment_status: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
  fulfillment_status: z
    .enum(["pending", "processing", "shipped", "delivered", "cancelled", "returned"])
    .optional(),
});

const QuerySchema = z.object({ cursor: z.string().datetime().optional(), query: z.string().trim().max(120).optional(), fulfillment: z.enum(["pending","processing","shipped","delivered","cancelled","returned"]).optional(), payment: z.enum(["pending","paid","failed","refunded"]).optional(), customerType: z.string().trim().max(80).optional(), dateFrom: z.string().datetime().optional(), dateTo: z.string().datetime().optional(), limit: z.coerce.number().int().min(1).max(100).optional() });

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid filters" }, { status: 422 });
  try { return NextResponse.json(await listAdminOrders(parsed.data)); }
  catch { return NextResponse.json({ error: "Orders unavailable" }, { status: 503 }); }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = getSupabaseServiceClient();
  if (!sb)
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const json = await request.json().catch(() => null);
  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 });
  }
  const { id, ...update } = parsed.data;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const isBeingCancelled = update.fulfillment_status === "cancelled";
  const { data: existingOrder } = isBeingCancelled
    ? await sb
        .from("orders")
        .select(
          "id, order_number, customer_phone, grand_total, fulfillment_status, order_items(product_id, price, quantity)",
        )
        .eq("id", id)
        .maybeSingle()
    : { data: null };

  const { data: updated, error } = await sb
    .from("orders")
    .update(update)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!updated)
    return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (existingOrder && existingOrder.fulfillment_status !== "cancelled") {
    after(() => sendCancelledOrderToMeta(existingOrder));
  }

  return NextResponse.json({ ok: true });
}
