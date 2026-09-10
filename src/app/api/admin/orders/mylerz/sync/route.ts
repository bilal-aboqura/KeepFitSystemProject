import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { syncOpenMylerzShipmentStatuses } from "@/lib/shipment-status-sync";

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ data: await syncOpenMylerzShipmentStatuses() });
  } catch (error) {
    console.error("[POST /api/admin/orders/mylerz/sync]", error);
    return NextResponse.json({ error: "Mylerz status sync failed" }, { status: 500 });
  }
}
