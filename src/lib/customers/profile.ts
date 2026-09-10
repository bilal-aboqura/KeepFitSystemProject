import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { profileSchema } from "./validation";
import type { Customer } from "./types";

export async function updateCustomerProfile(customer: Customer, input: unknown) {
  const parsed = profileSchema.parse(input);
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data, error } = await sb.from("customers").update(parsed).eq("id", customer.id).select("*").single();
  if (error) throw error;
  if (customer.auth_user_id) await sb.from("profiles").update({ full_name: parsed.full_name, phone: parsed.phone }).eq("id", customer.auth_user_id);
  return data as Customer;
}
