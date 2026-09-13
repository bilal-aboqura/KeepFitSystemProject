import { after, NextResponse } from "next/server";
import { confirmationCookieOptions, confirmationGrantCookieName } from "@/lib/customers/grants";
import { finalizeConfirmedQuote } from "@/lib/commerce/finalization";
import { commerceErrorResponse, parseCommerceBody } from "@/lib/commerce/http";
import { orderSubmissionInputSchema } from "@/lib/commerce/validation";
import { getOrderByNumber } from "@/lib/data/orders";
import { sendNewOrderNotifications } from "@/lib/notifications";
import { sendPurchaseOrderToMeta } from "@/lib/meta-conversions";

export async function POST(request: Request) {
  try {
    const input = await parseCommerceBody(request, orderSubmissionInputSchema);
    const result = await finalizeConfirmedQuote(input);
    if (!result.replayed) {
      try {
        after(async () => {
          const order = await getOrderByNumber(result.orderNumber);
          if (order) await Promise.all([sendNewOrderNotifications(order), sendPurchaseOrderToMeta(order)]);
        });
      } catch (error) {
        if (process.env.NODE_ENV !== "test") throw error;
      }
    }
    const response = NextResponse.json(result);
    if (result.confirmationGrant) {
      response.cookies.set(
        confirmationGrantCookieName(result.orderNumber),
        result.confirmationGrant.secret,
        { ...confirmationCookieOptions, expires: result.confirmationGrant.expiresAt },
      );
    }
    return response;
  } catch (error) {
    return commerceErrorResponse(error);
  }
}
