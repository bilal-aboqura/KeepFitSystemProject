import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { setDefaultPriceList } from "@/lib/pricing/commands";
import { pricingHttpError } from "@/lib/pricing/http";

export async function PUT(request: Request) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try { return NextResponse.json(await setDefaultPriceList(await request.json(), authorization.user.id)); } catch (error) { return pricingHttpError(error); }
}
