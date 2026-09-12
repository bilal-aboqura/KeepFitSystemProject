import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { bulkSavePriceListItems, listPriceListItems } from "@/lib/pricing/commands";
import { pricingHttpError } from "@/lib/pricing/http";
import { priceListIdParamsSchema } from "@/lib/pricing/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try { const { id } = priceListIdParamsSchema.parse(await params); return NextResponse.json({ items: await listPriceListItems(id) }); } catch (error) { return pricingHttpError(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try { const { id } = priceListIdParamsSchema.parse(await params); return NextResponse.json(await bulkSavePriceListItems(id, await request.json(), authorization.user.id)); } catch (error) { return pricingHttpError(error); }
}
