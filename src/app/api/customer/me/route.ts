import { NextResponse } from "next/server";
import { customerHandler } from "@/lib/customers/http";
import { isCustomerProfileComplete } from "@/lib/customers/identity";
import { customerDTO,updateCustomerProfile } from "@/lib/customers/profile";
export function GET(){return customerHandler(async c=>NextResponse.json({customer:customerDTO(c),complete:isCustomerProfileComplete(c)}));}
export function PATCH(r:Request){return customerHandler(async c=>NextResponse.json({customer:customerDTO(await updateCustomerProfile(c,await r.json()))}));}
