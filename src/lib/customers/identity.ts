import "server-only";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { profileSchema } from "./validation";
import type { Customer } from "./types";
export function isCustomerProfileComplete(customer: Pick<Customer, "full_name" | "phone">) {
  return profileSchema.safeParse({ full_name: customer.full_name, phone: customer.phone }).success;
}
export async function resolveCustomerForUser(user: User): Promise<Customer> {
  const sb = getSupabaseServiceClient();
  if (!sb) throw new Error("Customer service unavailable");
  const { data, error } = await sb.rpc("customer_resolve", { p_user_id: user.id });
  if (error || !data) throw new Error("Could not resolve customer");
  return data as Customer;
}
