import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/customers/session";
import { listCustomerOrders } from "@/lib/customers/queries";
export async function GET() { const customer = await getCurrentCustomer(); return customer ? NextResponse.json({ orders: await listCustomerOrders(customer.id) }) : NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
