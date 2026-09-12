import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/customers/session";
import { listCustomerTypeHistory } from "@/lib/customers/type-requests";

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ history: await listCustomerTypeHistory(customer.id) });
}
