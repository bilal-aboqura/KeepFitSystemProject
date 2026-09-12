import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { schedulePriceListItem } from "@/lib/pricing/commands";
import { pricingHttpError } from "@/lib/pricing/http";
import { priceListIdParamsSchema } from "@/lib/pricing/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try { const { id } = priceListIdParamsSchema.parse(await params); return NextResponse.json(await schedulePriceListItem(id, await request.json(), authorization.user.id), { status: 201 }); } catch (error) { return pricingHttpError(error); }
}
