import { requireAdmin } from "@/lib/admin-auth";
import { BostaIntegrationError, downloadBostaAwb } from "@/lib/bosta";
import { getBostaOrderById } from "@/lib/bosta-store";

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return Response.json({ error: "Invalid order" }, { status: 400 });
    const order = await getBostaOrderById(id);
    if (!order?.bosta?.trackingNumber) {
      return Response.json({ error: "Order has no Bosta shipment" }, { status: 404 });
    }
    const pdf = await downloadBostaAwb(order.bosta.trackingNumber);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="bosta-${order.bosta.trackingNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof BostaIntegrationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/admin/orders/bosta/awb]", error);
    return Response.json({ error: "Could not download Bosta AWB" }, { status: 500 });
  }
}
