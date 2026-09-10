import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getBostaConfiguration,
  BostaIntegrationError,
  createBostaDelivery,
  syncBostaDelivery,
} from "@/lib/bosta";
import { getBostaOrderById, storeBostaShipment } from "@/lib/bosta-store";
import { claimShipmentCreation, releaseShipmentCreation } from "@/lib/shipment-creation";

const ActionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["create", "sync"]),
});

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = ActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Bosta action" }, { status: 422 });
  }

  let claimedId: string | null = null;
  try {
    const order = await getBostaOrderById(parsed.data.id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!getBostaConfiguration().ready) return NextResponse.json({ error: "Bosta configuration is incomplete" }, { status: 503 });
    if (parsed.data.action === "create") {
      if (!(await claimShipmentCreation(order.id, "bosta"))) return NextResponse.json({ error: "الطلب مرتبط بشحنة أو جاري إنشاؤها. راجع حساب الشحن قبل إعادة المحاولة." }, { status: 409 });
      claimedId = order.id;
    }
    const shipment = parsed.data.action === "create"
      ? await createBostaDelivery(order)
      : order.bosta
        ? await syncBostaDelivery(order.bosta)
        : null;
    if (!shipment) {
      return NextResponse.json({ error: "Create the Bosta shipment first" }, { status: 400 });
    }
    const updated = await storeBostaShipment(order, shipment);
    if (claimedId) await releaseShipmentCreation(claimedId);
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (claimedId && error instanceof BostaIntegrationError && error.status < 500) await releaseShipmentCreation(claimedId);
    if (error instanceof BostaIntegrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/admin/orders/bosta]", error);
    return NextResponse.json({ error: "Bosta action failed" }, { status: 500 });
  }
}
