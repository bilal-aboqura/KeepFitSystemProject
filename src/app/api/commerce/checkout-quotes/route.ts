import { NextResponse } from "next/server";
import { commerceErrorResponse, parseCommerceBody } from "@/lib/commerce/http";
import { createCheckoutQuote } from "@/lib/commerce/quote";
import { checkoutQuoteInputSchema } from "@/lib/commerce/validation";

export async function POST(request: Request) {
  try {
    const input = await parseCommerceBody(request, checkoutQuoteInputSchema);
    return NextResponse.json(await createCheckoutQuote(input), { status: 201 });
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
