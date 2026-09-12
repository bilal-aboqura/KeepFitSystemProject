import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { customerTypeErrorStatus } from "@/lib/customers/customer-types";
import { assignCustomerType } from "@/lib/customers/type-approval";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const auth = await requireAdminUser();
  if (auth.denied) return auth.denied;
  const body = await request.json().catch(() => null);
  const result = await assignCustomerType((await params).customerId, auth.user.id, body);
  return result.ok
    ? NextResponse.json({ assignment: result.data })
    : NextResponse.json({ error: result.error }, { status: customerTypeErrorStatus(result.error) });
}
