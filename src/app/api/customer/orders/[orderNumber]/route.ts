import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/customers/session";
import { getCustomerOrder } from "@/lib/customers/queries";
export async function GET(_: Request, { params }: { params: Promise<{ orderNumber: string }> }) { const customer = await getCurrentCustomer(); if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const order = await getCustomerOrder(customer.id, (await params).orderNumber); return order ? NextResponse.json({ order }) : NextResponse.json({ error: "Not found" }, { status: 404 }); }
