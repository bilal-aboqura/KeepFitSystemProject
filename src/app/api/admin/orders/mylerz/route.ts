import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { getBostaOrderById } from "@/lib/bosta-store";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  getMylerzConfiguration,
  createMylerzShipment,
  syncMylerzShipment,
  verifyMylerzConnection,
  orderStatusForMylerzStatus,
  MylerzIntegrationError,
} from "@/lib/mylerz";
import { mylerzStatusKind } from "@/lib/mylerz-status";
import {
  claimShipmentCreation,
  releaseShipmentCreation,
} from "@/lib/shipment-creation";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify") }),
  z.object({ action: z.enum(["create", "sync"]), id: z.string().uuid() }),
]);

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid Mylerz action" },
      { status: 422 },
    );
  let claimedId: string | null = null;
  try {
    if (parsed.data.action === "verify")
      return NextResponse.json({ data: await verifyMylerzConnection() });
    const sb = getSupabaseServiceClient();
    if (!sb)
      return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
    const order = await getBostaOrderById(parsed.data.id);
    if (!order)
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!getMylerzConfiguration().ready)
      return NextResponse.json(
        { error: "إعداد Mylerz غير مكتمل." },
        { status: 503 },
      );
    if (parsed.data.action === "create") {
      if (!(await claimShipmentCreation(order.id, "mylerz")))
        return NextResponse.json(
          {
            error:
              "الطلب مرتبط بشحنة أو جاري إنشاؤها. راجع حساب الشحن قبل إعادة المحاولة.",
          },
          { status: 409 },
        );
      claimedId = order.id;
    }
    const shipment =
      parsed.data.action === "create"
        ? await createMylerzShipment(order)
        : order.mylerz
          ? await syncMylerzShipment(order.mylerz)
          : null;
    if (!shipment)
      return NextResponse.json(
        { error: "أنشئ شحنة Mylerz أولًا." },
        { status: 400 },
      );
    const { data, error } = await sb
      .from("orders")
      .update({
        mylerz: shipment,
        shipment_creation: null,
        fulfillment_status: orderStatusForMylerzStatus(
          shipment.status,
          order.fulfillment_status,
        ),
        ...(mylerzStatusKind(shipment.status) === "delivered" &&
        order.payment_method === "cod"
          ? { payment_status: "paid" }
          : {}),
      })
      .eq("id", order.id)
      .is("bosta", null)
      .select("*")
      .single();
    if (error) {
      console.error("Mylerz shipment persistence failed", {
        orderId: order.id,
        trackingNumber: shipment.trackingNumber,
        error,
      });
      return NextResponse.json(
        {
          error: `تمت العملية لدى Mylerz ولكن تعذر الحفظ. رقم التتبع: ${shipment.trackingNumber}. راجع الشحنة قبل إعادة المحاولة.`,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ data });
  } catch (error) {
    if (
      claimedId &&
      error instanceof MylerzIntegrationError &&
      error.status < 500
    )
      await releaseShipmentCreation(claimedId);
    if (error instanceof MylerzIntegrationError)
      return NextResponse.json(
        {
          error:
            claimedId && error.status >= 500
              ? `${error.message} راجع حساب Mylerz قبل إعادة المحاولة لتجنب تكرار الشحنة.`
              : error.message,
        },
        { status: error.status },
      );
    console.error("Mylerz action failed", error);
    return NextResponse.json(
      { error: "تعذر تنفيذ طلب Mylerz حاليًا." },
      { status: 500 },
    );
  }
}
