import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { commerceErrorResponse } from "@/lib/commerce/http";
import { archiveQuantityRule } from "@/lib/commerce/quantity-rules";

export async function DELETE(request: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  const authorization = await requireAdminUser();
  if (authorization.denied) return authorization.denied;
  try {
    const { ruleId } = await params;
    return NextResponse.json(await archiveQuantityRule(ruleId, await request.json(), authorization.user.id));
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
