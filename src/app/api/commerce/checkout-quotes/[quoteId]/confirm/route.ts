import { NextResponse } from "next/server";
import { commerceErrorResponse, parseCommerceBody } from "@/lib/commerce/http";
import { confirmCheckoutQuote } from "@/lib/commerce/confirmation";
import { quoteConfirmationInputSchema } from "@/lib/commerce/validation";

export async function POST(request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  try {
    const { quoteId } = await params;
    const input = await parseCommerceBody(request, quoteConfirmationInputSchema);
    return NextResponse.json(await confirmCheckoutQuote(quoteId, input.revision));
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
