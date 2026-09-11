import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { profileSchema } from "./validation";
import type { Customer } from "./types";
export function customerDTO(customer: Customer) {
  return { id: customer.id, full_name: customer.full_name, phone: customer.phone, email: customer.email, created_at: customer.created_at };
}
export async function updateCustomerProfile(customer: Customer, input: unknown): Promise<Customer> {
  const parsed = profileSchema.parse(input);
  const sb = getSupabaseServiceClient();
  if (!sb) throw new Error("Customer service unavailable");
  const { data, error } = await sb.rpc("customer_profile_update", {
    p_customer_id: customer.id, p_name: parsed.full_name, p_phone: parsed.phone,
  });
  if (error || !data) throw new Error("Could not update profile");
  return data as Customer;
}
