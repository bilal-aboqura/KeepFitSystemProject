import { NextResponse, type NextRequest } from "next/server";
import { getCurrentCustomer } from "@/lib/customers/session";
import { setCustomerDefaultAddress } from "@/lib/customers/addresses";
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { const c = await getCurrentCustomer(); if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const a = await setCustomerDefaultAddress(c.id, (await params).id); return a ? NextResponse.json({ address: a }) : NextResponse.json({ error: "Not found" }, { status: 404 }); }
