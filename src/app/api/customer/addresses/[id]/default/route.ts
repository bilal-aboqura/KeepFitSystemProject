import { NextResponse } from "next/server";
import { customerHandler,customerIdSchema } from "@/lib/customers/http";
import { setCustomerDefaultAddress } from "@/lib/customers/addresses";
export function POST(_:Request,{params}:{params:Promise<{id:string}>}){return customerHandler(async c=>{
  const id=customerIdSchema.parse((await params).id);const address=await setCustomerDefaultAddress(c.id,id);
  return address?NextResponse.json({address}):NextResponse.json({error:"Not found"},{status:404});
});}
