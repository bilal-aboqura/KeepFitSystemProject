import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { sendPurchaseOrderToMeta } from "@/lib/meta-conversions";

const Schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(25),
});

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 422 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, governorate, city, grand_total, order_items(product_id, price, quantity)")
    .in("id", parsed.data.ids);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if ((orders ?? []).length !== parsed.data.ids.length) {
    return NextResponse.json({ error: "One or more orders were not found" }, { status: 404 });
  }

  const results = await Promise.all(
    (orders ?? []).map(async (order) => ({
      id: order.id,
      ...(await sendPurchaseOrderToMeta(order)),
    })),
  );
  if (results.some((result) => !result.sent)) {
    return NextResponse.json({ error: "Meta CAPI is not configured" }, { status: 503 });
  }

  return NextResponse.json({ sent: results.length });
}
