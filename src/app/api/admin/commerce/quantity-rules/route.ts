import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/admin-auth";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { listQuantityRules, setQuantityRule } from "@/lib/commerce/quantity-rules";
import { CommerceError } from "@/lib/commerce/errors";

const querySchema = z.object({ cursor: z.string().datetime().optional(), limit: z.coerce.number().int().min(1).max(100).optional(), variantId: z.string().uuid().optional() });

export async function GET(request: Request) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new CommerceError("INVALID_JSON", { status: 422 });
    return NextResponse.json(await listQuantityRules(parsed.data));
  } catch (error) {
    return commerceErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try {
    return NextResponse.json(await setQuantityRule(await request.json(), authorization.user.id));
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
