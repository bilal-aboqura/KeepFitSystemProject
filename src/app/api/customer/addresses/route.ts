import { NextResponse } from "next/server";
import { customerHandler } from "@/lib/customers/http";
import { createCustomerAddress,listCustomerAddresses } from "@/lib/customers/addresses";
export function GET(){return customerHandler(async c=>NextResponse.json({addresses:await listCustomerAddresses(c.id)}));}
export function POST(r:Request){return customerHandler(async c=>NextResponse.json({address:await createCustomerAddress(c.id,await r.json())},{status:201}));}
