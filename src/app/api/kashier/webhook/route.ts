import { after, NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature, extractWebhookResult } from "@/lib/kashier";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getOrderByNumber } from "@/lib/data/orders";
import { sendNewOrderNotifications } from "@/lib/notifications";
import { sendPurchaseOrderToMeta } from "@/lib/meta-conversions";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!verifyWebhookSignature(body as never)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const result = extractWebhookResult(body as never);
  if (!result.orderId) {
    return NextResponse.json({ ok: true });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  }

  const isSuccess =
    result.event === "pay" ||
    /^success$/i.test(result.status) ||
    /^paid$/i.test(result.status);

  let updateQuery = sb
    .from("orders")
    .update({
      payment_status: isSuccess ? "paid" : "failed",
      kashier_payment_id: result.kashierPaymentId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("order_number", result.orderId)
    .eq("payment_method", "card");

  if (isSuccess) {
    updateQuery = updateQuery.neq("payment_status", "paid");
  }

  const { data: updatedOrders, error } = await updateQuery.select("id");

  if (error) {
    console.error("webhook order update failed:", error.message);
  }

  if (isSuccess && updatedOrders?.length) {
    after(async () => {
      const order = await getOrderByNumber(result.orderId);
      if (order) {
        await Promise.all([
          sendNewOrderNotifications(order),
          sendPurchaseOrderToMeta(order),
        ]);
      }
    });
  }

  return NextResponse.json({ ok: true });
}
