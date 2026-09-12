import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { getPriceList, updatePriceList } from "@/lib/pricing/commands";
import { pricingHttpError } from "@/lib/pricing/http";
import { priceListIdParamsSchema } from "@/lib/pricing/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try {
    const { id } = priceListIdParamsSchema.parse(await params);
    const list = await getPriceList(id);
    return list ? NextResponse.json({ list }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) { return pricingHttpError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try {
    const { id } = priceListIdParamsSchema.parse(await params);
    return NextResponse.json({ list: await updatePriceList(id, await request.json(), authorization.user.id) });
  } catch (error) { return pricingHttpError(error); }
}
