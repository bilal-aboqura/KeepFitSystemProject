import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { diagnosePrice } from "@/lib/pricing/diagnostics";
import { pricingHttpError } from "@/lib/pricing/http";
import { pricingDiagnosticInputSchema } from "@/lib/pricing/validation";

export async function POST(request: Request) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try {
    const input = pricingDiagnosticInputSchema.parse(await request.json());
    return NextResponse.json(await diagnosePrice({ customerId: input.customer_id, variantId: input.variant_id, sellableUnitId: input.sellable_unit_id, at: input.at }));
  } catch (error) { return pricingHttpError(error); }
}
