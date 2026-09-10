import { NextResponse, type NextRequest } from "next/server";
import { getShippingCostForProducts } from "@/lib/data/orders";

/** GET /api/shipping?governorate=...&city=... → { cost, matched } */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const governorate = searchParams.get("governorate") ?? "";
  const city = searchParams.get("city") ?? "";
  const productIds = (searchParams.get("products") ?? "").split(",");
  if (!governorate.trim() || !city.trim() || productIds.length > 100 ||
    productIds.some((id) => !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }
  try {
    const quote = await getShippingCostForProducts(governorate, city, productIds);
    return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "تعذر حساب الشحن. حاول مرة أخرى." }, { status: 503 });
  }
}
