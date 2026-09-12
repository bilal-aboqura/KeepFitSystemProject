import "server-only";
import { getCurrentCustomer } from "@/lib/customers/session";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { CustomerPricingContext } from "./types";

export const GUEST_PRICING_CONTEXT: CustomerPricingContext = {
  customerId: null,
  customerTypeId: null,
  customerTypeCode: null,
  directPriceListId: null,
};

export async function getCurrentPricingContext(): Promise<CustomerPricingContext> {
  const customer = await getCurrentCustomer();
  if (!customer) return GUEST_PRICING_CONTEXT;
  return getCustomerPricingContext(customer.id);
}

export async function getCustomerPricingContext(customerId: string): Promise<CustomerPricingContext> {
  const db = getSupabaseServiceClient();
  if (!db) return GUEST_PRICING_CONTEXT;
  const { data, error } = await db.from("customers")
    .select("id,direct_price_list_id,customer_type:customer_types(id,code,is_active)")
    .eq("id", customerId).maybeSingle();
  if (error) throw new Error("Pricing customer context is unavailable");
  if (!data) return GUEST_PRICING_CONTEXT;
  const relation = Array.isArray(data.customer_type) ? data.customer_type[0] : data.customer_type;
  const customerType = relation?.is_active ? relation : null;
  return {
    customerId: data.id,
    customerTypeId: customerType?.id ?? null,
    customerTypeCode: customerType?.code ?? null,
    directPriceListId: data.direct_price_list_id ?? null,
  };
}
