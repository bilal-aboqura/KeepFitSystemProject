import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { BostaIntegrationError } from "@/lib/bosta";
import { runBostaPickupAutomation } from "@/lib/bosta-pickups";

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ data: await runBostaPickupAutomation({ ignoreTime: true }) });
  } catch (error) {
    if (error instanceof BostaIntegrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/admin/orders/bosta/pickup]", error);
    return NextResponse.json({ error: "Bosta pickup failed" }, { status: 500 });
  }
}
