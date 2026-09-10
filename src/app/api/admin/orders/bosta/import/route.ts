import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { BostaIntegrationError } from "@/lib/bosta";
import { importExistingBostaDeliveries } from "@/lib/bosta-store";

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json({ data: await importExistingBostaDeliveries() });
  } catch (error) {
    if (error instanceof BostaIntegrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/admin/orders/bosta/import]", error);
    return NextResponse.json({ error: "Bosta import failed" }, { status: 500 });
  }
}
