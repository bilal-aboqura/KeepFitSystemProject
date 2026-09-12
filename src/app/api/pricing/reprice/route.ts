import { NextResponse } from "next/server";
import { getCurrentPricingContext } from "@/lib/pricing/context";
import { calculateLineTotalMinor, formatMinorAmount } from "@/lib/pricing/money";
import { projectPublicPrice } from "@/lib/pricing/public-projection";
import { resolvePrices } from "@/lib/pricing/resolver";
import { repriceInputSchema } from "@/lib/pricing/validation";

export async function POST(request: Request) {
  const parsed = repriceInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "PRICING_TARGET_INVALID", issues: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const context = await getCurrentPricingContext();
    const prices = await resolvePrices({
      customerContext: context,
      targets: parsed.data.items.map((item) => ({ variantId: item.variant_id, sellableUnitId: item.sellable_unit_id })),
    });
    const quantities = new Map(parsed.data.items.map((item) => [`${item.variant_id}:${item.sellable_unit_id}`, item.quantity]));
    const items = prices.map((price) => {
      const projected = projectPublicPrice(price);
      if (price.availability === "unavailable" || projected.availability === "unavailable") return projected;
      const quantity = quantities.get(`${price.variantId}:${price.sellableUnitId}`) ?? 1;
      const lineAmount = calculateLineTotalMinor(price.amountMinor, quantity);
      return { ...projected, quantity, lineAmountMinor: lineAmount.toString(), displayLineAmount: formatMinorAmount(lineAmount) };
    });
    if (items.some((item) => item.availability === "unavailable")) {
      return NextResponse.json({ code: "PRICE_UNAVAILABLE", items }, { status: 409 });
    }
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ code: "PRICE_UNAVAILABLE" }, { status: 503 });
  }
}
