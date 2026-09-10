import { NextResponse, type NextRequest } from "next/server";
import { getCurrentCustomer } from "@/lib/customers/session";
import { isCustomerProfileComplete } from "@/lib/customers/identity";
import { updateCustomerProfile } from "@/lib/customers/profile";
import { z } from "zod";
export async function GET() { const customer = await getCurrentCustomer(); return customer ? NextResponse.json({ customer, complete: isCustomerProfileComplete(customer) }) : NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
export async function PATCH(request: NextRequest) { const customer = await getCurrentCustomer(); if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); try { return NextResponse.json({ customer: await updateCustomerProfile(customer, await request.json()) }); } catch (error) { return NextResponse.json({ error: error instanceof z.ZodError ? "Validation failed" : "Could not update profile." }, { status: 422 }); } }
