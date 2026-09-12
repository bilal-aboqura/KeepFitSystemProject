import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { assignCustomerPriceList, removeCustomerPriceList } from "@/lib/pricing/commands";
import { pricingHttpError } from "@/lib/pricing/http";
import { customerIdParamsSchema } from "@/lib/pricing/validation";

export async function PUT(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try { const { customerId } = customerIdParamsSchema.parse(await params); return NextResponse.json(await assignCustomerPriceList(customerId, await request.json(), authorization.user.id)); } catch (error) { return pricingHttpError(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try { const { customerId } = customerIdParamsSchema.parse(await params); return NextResponse.json(await removeCustomerPriceList(customerId, authorization.user.id)); } catch (error) { return pricingHttpError(error); }
}
