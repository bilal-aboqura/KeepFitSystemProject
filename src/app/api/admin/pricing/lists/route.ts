import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { createPriceList, listPriceLists } from "@/lib/pricing/commands";
import { pricingHttpError } from "@/lib/pricing/http";

export async function GET() {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try { return NextResponse.json({ lists: await listPriceLists() }); } catch (error) { return pricingHttpError(error); }
}

export async function POST(request: Request) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try { return NextResponse.json({ list: await createPriceList(await request.json(), authorization.user.id) }, { status: 201 }); } catch (error) { return pricingHttpError(error); }
}
