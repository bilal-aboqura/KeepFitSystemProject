import { NextResponse } from "next/server";
import { customerHandler } from "@/lib/customers/http";
import { listCustomerOrders } from "@/lib/customers/queries";
export function GET(r:Request){return customerHandler(async c=>NextResponse.json({orders:await listCustomerOrders(c.id,Number(new URL(r.url).searchParams.get("page")||1))}));}
