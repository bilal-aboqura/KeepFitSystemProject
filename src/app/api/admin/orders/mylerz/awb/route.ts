import { requireAdmin } from "@/lib/admin-auth";
import { MylerzIntegrationError, downloadMylerzAwb } from "@/lib/mylerz";
import { getBostaOrderById } from "@/lib/bosta-store";

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return Response.json({ error: "Invalid order" }, { status: 400 });
    const order = await getBostaOrderById(id);
    if (!order?.mylerz?.trackingNumber) {
      return Response.json(
        { error: "Order has no Mylerz shipment" },
        { status: 404 },
      );
    }
    const pdf = await downloadMylerzAwb(order.mylerz.trackingNumber);
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="mylerz-${order.mylerz.trackingNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof MylerzIntegrationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/admin/orders/mylerz/awb]", error);
    return Response.json(
      { error: "Could not download Mylerz AWB" },
      { status: 500 },
    );
  }
}
