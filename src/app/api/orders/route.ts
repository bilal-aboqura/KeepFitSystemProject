import { checkoutPhoneSchema } from "@/lib/customers/validation";
import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createOrder, getOrderByNumber } from "@/lib/data/orders";
import { createCheckoutUrl } from "@/lib/kashier";
import { sendNewOrderNotifications } from "@/lib/notifications";
import { sendPurchaseOrderToMeta } from "@/lib/meta-conversions";
import { getCurrentCustomer } from "@/lib/customers/session";
import { isCustomerProfileComplete } from "@/lib/customers/identity";
import { confirmationGrantCookieName, confirmationCookieOptions } from "@/lib/customers/grants";
import { CatalogError } from "@/lib/catalog/errors";

const ItemSchema = z.object({
  variant_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  image: z.string().optional(),
  offer: z.literal("order_bump").optional(),
  offer_key: z.string().trim().min(1).max(80).optional(),
}).refine((item) => Boolean(item.variant_id || item.product_id), { error: "A variant is required" });


const BodySchema = z.object({
  customer_name: z.string().min(2).max(120),
  customer_phone: checkoutPhoneSchema,
  alt_phone: checkoutPhoneSchema,
  governorate: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(3).max(500),
  notes: z.string().max(1000).optional(),
  payment_method: z.enum(["card", "cod"]),
  discount_code: z.string().optional().nullable(),
  items: z.array(ItemSchema).min(1),
}).refine((data) => data.customer_phone !== data.alt_phone, {
  error: "The alternative phone number must be different from the main phone number.",
  path: ["alt_phone"],
});

export async function POST(request: NextRequest) {
  try {
    return await placeOrder(request);
  } catch (error) {
    if (error instanceof CatalogError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again." }, { status: 503 });
  }
}

async function placeOrder(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const customer = await getCurrentCustomer();
  if (customer && !isCustomerProfileComplete(customer)) {
    return NextResponse.json({ error: "Complete your account profile before placing an authenticated order.", redirect: "/account/complete-profile" }, { status: 422 });
  }
  const order = await createOrder({
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    alt_phone: input.alt_phone,
    governorate: input.governorate,
    city: input.city,
    address: input.address,
    notes: input.notes,
    payment_method: input.payment_method,
    discount_code: input.discount_code ?? null,
    customer_id: customer?.id ?? null,
    user_id: customer?.auth_user_id ?? null,
    items: input.items,
  });

  if (!order) {
    return NextResponse.json(
      { error: "Could not create order. Please try again." },
      { status: 500 },
    );
  }

  // COD: order is complete; redirect to the confirmation page.
  if (input.payment_method === "cod") {
    after(async () => {
      const savedOrder = await getOrderByNumber(order.order_number);
      if (savedOrder) {
        await Promise.all([
          sendNewOrderNotifications(savedOrder),
          sendPurchaseOrderToMeta(savedOrder),
        ]);
      }
    });
    const response = NextResponse.json({
      order_number: order.order_number,
      redirect: `/checkout/success?order=${order.order_number}`,
    });
    if (order.confirmationGrant) response.cookies.set(confirmationGrantCookieName(order.order_number), order.confirmationGrant.secret, { ...confirmationCookieOptions, expires: order.confirmationGrant.expiresAt });
    return response;
  }

  // Card: build the Kashier hosted-checkout URL.
  try {
    const checkoutUrl = createCheckoutUrl({
      orderId: order.order_number,
      amount: Number(order.grand_total),
      metaData: {
        orderId: order.id,
        orderNumber: order.order_number,
      },
      customerName: input.customer_name,
    });
    const response = NextResponse.json({
      order_number: order.order_number,
      redirect: checkoutUrl,
    });
    if (order.confirmationGrant) response.cookies.set(confirmationGrantCookieName(order.order_number), order.confirmationGrant.secret, { ...confirmationCookieOptions, expires: order.confirmationGrant.expiresAt });
    return response;
  } catch (e) {
    console.error("Kashier checkout URL failed:", e);
    return NextResponse.json(
      {
        error: "Payment gateway is not configured. Try Cash on Delivery instead.",
        order_number: order.order_number,
      },
      { status: 502 },
    );
  }
}
