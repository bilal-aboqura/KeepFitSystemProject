import { NextResponse } from "next/server";
import { commerceErrorResponse, parseCommerceBody } from "@/lib/commerce/http";
import { buildCartQuote } from "@/lib/commerce/quote";
import { cartQuoteInputSchema } from "@/lib/commerce/validation";

export async function POST(request: Request) {
  try {
    const input = await parseCommerceBody(request, cartQuoteInputSchema);
    return NextResponse.json(await buildCartQuote(input));
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
