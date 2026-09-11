import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { customerTypeErrorStatus } from "@/lib/customers/customer-types";
import { approveCustomerTypeRequest } from "@/lib/customers/type-approval";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const auth = await requireAdminUser();
  if (auth.denied) return auth.denied;
  const result = await approveCustomerTypeRequest((await params).requestId, auth.user.id);
  return result.ok
    ? NextResponse.json({ request: result.data })
    : NextResponse.json({ error: result.error }, { status: customerTypeErrorStatus(result.error) });
}
