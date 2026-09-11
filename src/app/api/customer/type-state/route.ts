import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/customers/session";
import { getCustomerTypeState } from "@/lib/customers/type-requests";

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await getCustomerTypeState(customer.id);
  return state
    ? NextResponse.json({ state })
    : NextResponse.json({ error: "Service unavailable" }, { status: 503 });
}
