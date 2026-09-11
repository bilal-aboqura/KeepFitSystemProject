import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentCustomer } from "./session";
import type { Customer } from "./types";
export async function customerHandler(run:(c:Customer)=>Promise<Response>) {
  try {
    const c=await getCurrentCustomer();
    if(!c)return NextResponse.json({error:"Unauthorized"},{status:401});
    const response=await run(c);response.headers.set("Cache-Control","private, no-store");return response;
  } catch(error) {
    return NextResponse.json({error:error instanceof z.ZodError?"Validation failed":"Customer service unavailable"},{status:error instanceof z.ZodError?422:error instanceof SyntaxError?400:503});
  }
}
export const customerIdSchema=z.string().uuid();
