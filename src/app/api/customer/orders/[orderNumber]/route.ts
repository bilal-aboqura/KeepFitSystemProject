import { NextResponse } from "next/server";
import { customerHandler } from "@/lib/customers/http";
import { getCustomerOrder } from "@/lib/customers/queries";
export function GET(_:Request,{params}:{params:Promise<{orderNumber:string}>}){return customerHandler(async c=>{
  const order=await getCustomerOrder(c.id,(await params).orderNumber);
  return order?NextResponse.json({order}):NextResponse.json({error:"Not found"},{status:404});
});}
