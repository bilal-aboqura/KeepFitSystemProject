import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { syncOpenShipmentStatuses } from "@/lib/shipment-status-sync";

function secureEqual(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slot: string }> },
) {
  await params;
  const expected = process.env.CRON_SECRET?.trim() ?? "";
  const received = request.headers.get("authorization") ?? "";
  if (!expected || !secureEqual(received, `Bearer ${expected}`)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, result: await syncOpenShipmentStatuses() });
  } catch (error) {
    console.error("[Shipment status cron]", error);
    return NextResponse.json(
      { ok: false, error: "Shipment status sync failed" },
      { status: 500 },
    );
  }
}
