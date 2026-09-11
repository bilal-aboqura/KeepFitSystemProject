import { NextResponse } from "next/server";
import { customerHandler,customerIdSchema } from "@/lib/customers/http";
import { deleteCustomerAddress,updateCustomerAddress } from "@/lib/customers/addresses";
type Context={params:Promise<{id:string}>};
export function PATCH(r:Request,{params}:Context){return customerHandler(async c=>{
  const id=customerIdSchema.parse((await params).id);const address=await updateCustomerAddress(c.id,id,await r.json());
  return address?NextResponse.json({address}):NextResponse.json({error:"Not found"},{status:404});
});}
export function DELETE(_:Request,{params}:Context){return customerHandler(async c=>{
  const id=customerIdSchema.parse((await params).id);
  return await deleteCustomerAddress(c.id,id)?new NextResponse(null,{status:204}):NextResponse.json({error:"Not found"},{status:404});
});}
