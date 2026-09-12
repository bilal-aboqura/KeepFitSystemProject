import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { listCustomerTypeMappings, setCustomerTypeMapping } from "@/lib/pricing/commands";
import { pricingHttpError } from "@/lib/pricing/http";

export async function GET() {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try { return NextResponse.json({ mappings: await listCustomerTypeMappings() }); } catch (error) { return pricingHttpError(error); }
}

export async function PUT(request: Request) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try { return NextResponse.json(await setCustomerTypeMapping(await request.json(), authorization.user.id)); } catch (error) { return pricingHttpError(error); }
}
