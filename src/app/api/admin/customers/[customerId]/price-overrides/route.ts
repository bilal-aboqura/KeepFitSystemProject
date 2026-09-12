import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { archiveCustomerPriceOverride, createCustomerPriceOverride, listCustomerPriceOverrides } from "@/lib/pricing/commands";
import { pricingHttpError } from "@/lib/pricing/http";
import { customerIdParamsSchema } from "@/lib/pricing/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try { const { customerId } = customerIdParamsSchema.parse(await params); return NextResponse.json({ overrides: await listCustomerPriceOverrides(customerId) }); } catch (error) { return pricingHttpError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try { const { customerId } = customerIdParamsSchema.parse(await params); return NextResponse.json(await createCustomerPriceOverride(customerId, await request.json(), authorization.user.id), { status: 201 }); } catch (error) { return pricingHttpError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try {
    const { customerId } = customerIdParamsSchema.parse(await params);
    const { id } = z.object({ id: z.string().uuid() }).strict().parse(await request.json());
    return NextResponse.json(await archiveCustomerPriceOverride(customerId, id, authorization.user.id));
  } catch (error) { return pricingHttpError(error); }
}
