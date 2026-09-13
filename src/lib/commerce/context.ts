import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getCurrentCustomer } from "@/lib/customers/session";
import { isCustomerProfileComplete } from "@/lib/customers/identity";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { CommerceContext, CommerceDeliveryAddress } from "./types";
import { CommerceError } from "./errors";

export const guestCheckoutCookieName = "keepfit_checkout_context";
const guestContextMaxAge = 24 * 60 * 60;

export function hashGuestCheckoutSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function createGuestCheckoutSecret() {
  return randomBytes(32).toString("base64url");
}

export async function resolveCommerceContext(options: { issueGuest?: boolean } = {}): Promise<CommerceContext> {
  const customer = await getCurrentCustomer();
  if (customer) {
    const db = getSupabaseServiceClient();
    if (!db) throw new CommerceError("CHECKOUT_UNAVAILABLE");
    const { data, error } = await db.from("customers")
      .select("id,auth_user_id,full_name,phone,direct_price_list_id,customer_type:customer_types!inner(id,code,name_en,name_ar,is_active)")
      .eq("id", customer.id).maybeSingle();
    if (error || !data) throw new CommerceError("CHECKOUT_UNAVAILABLE");
    const relation = Array.isArray(data.customer_type) ? data.customer_type[0] : data.customer_type;
    if (!relation?.is_active) throw new CommerceError("CHECKOUT_UNAVAILABLE");
    return {
      scopeKind: "customer",
      customerId: data.id,
      authUserId: data.auth_user_id,
      guestContextHash: null,
      contextKind: "customer_type",
      customerTypeId: relation.id,
      directPriceListId: data.direct_price_list_id,
      customerTypeCode: relation.code,
      customerTypeNameEn: relation.name_en,
      customerTypeNameAr: relation.name_ar,
      profileComplete: isCustomerProfileComplete({ full_name: data.full_name, phone: data.phone }),
    };
  }

  const cookieStore = await cookies();
  let secret = cookieStore.get(guestCheckoutCookieName)?.value;
  if (secret && !/^[A-Za-z0-9_-]{43}$/.test(secret)) secret = undefined;
  if (!secret && options.issueGuest) {
    secret = createGuestCheckoutSecret();
    cookieStore.set(guestCheckoutCookieName, secret, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: guestContextMaxAge,
    });
  }
  return {
    scopeKind: "guest",
    customerId: null,
    authUserId: null,
    guestContextHash: secret ? hashGuestCheckoutSecret(secret) : null,
    contextKind: "public",
    customerTypeId: null,
    directPriceListId: null,
    customerTypeCode: "public",
    customerTypeNameEn: "Public",
    customerTypeNameAr: "عام",
    profileComplete: true,
  };
}

export async function resolveOwnedDeliveryAddress(customerId: string, addressId: string): Promise<CommerceDeliveryAddress> {
  const db = getSupabaseServiceClient();
  if (!db) throw new CommerceError("CHECKOUT_UNAVAILABLE");
  const { data, error } = await db.from("addresses")
    .select("full_name,phone,governorate,city,address")
    .eq("id", addressId).eq("customer_id", customerId).maybeSingle();
  if (error) throw new CommerceError("CHECKOUT_UNAVAILABLE");
  if (!data) throw new CommerceError("DELIVERY_INVALID");
  return {
    fullName: data.full_name,
    phone: data.phone,
    altPhone: "",
    governorate: data.governorate,
    city: data.city,
    address: data.address,
  };
}
