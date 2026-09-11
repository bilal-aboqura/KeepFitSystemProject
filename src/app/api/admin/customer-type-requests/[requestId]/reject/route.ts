import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin-auth";
import { customerTypeErrorStatus } from "@/lib/customers/customer-types";
import { rejectCustomerTypeRequest } from "@/lib/customers/type-approval";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const auth = await requireAdminUser();
  if (auth.denied) return auth.denied;
  const body = await request.json().catch(() => null);
  const result = await rejectCustomerTypeRequest((await params).requestId, auth.user.id, body);
  return result.ok
    ? NextResponse.json({ request: result.data })
    : NextResponse.json({ error: result.error }, { status: customerTypeErrorStatus(result.error) });
}
