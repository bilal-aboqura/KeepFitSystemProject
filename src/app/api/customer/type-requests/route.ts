import { NextResponse, type NextRequest } from "next/server";
import { getCurrentCustomer } from "@/lib/customers/session";
import { customerTypeErrorStatus } from "@/lib/customers/customer-types";
import { createCustomerTypeRequest } from "@/lib/customers/type-requests";

export async function POST(request: NextRequest) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const result = await createCustomerTypeRequest(customer.id, body);
  return result.ok
    ? NextResponse.json({ request: result.data }, { status: 201 })
    : NextResponse.json({ error: result.error }, { status: customerTypeErrorStatus(result.error) });
}
