import { NextResponse, type NextRequest } from "next/server";
import { getCurrentCustomer } from "@/lib/customers/session";
import { createCustomerAddress, listCustomerAddresses } from "@/lib/customers/addresses";
export async function GET() { const c = await getCurrentCustomer(); return c ? NextResponse.json({ addresses: await listCustomerAddresses(c.id) }) : NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
export async function POST(r: NextRequest) { const c = await getCurrentCustomer(); if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); try { return NextResponse.json({ address: await createCustomerAddress(c.id, await r.json()) }, { status: 201 }); } catch { return NextResponse.json({ error: "Validation failed" }, { status: 422 }); } }
