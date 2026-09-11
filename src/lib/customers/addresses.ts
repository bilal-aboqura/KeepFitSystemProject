import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { addressSchema } from "./validation";
import type { CustomerAddress } from "./types";

export async function listCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  const { data, error } = await sb.from("addresses").select("id, customer_id, full_name, phone, governorate, city, address, is_default")
    .eq("customer_id", customerId).order("is_default", { ascending: false }).order("created_at");
  if (error) throw error;
  return data ?? [];
}
async function command(customerId: string, action: string, id: string | null, data = {}) {
  const sb = getSupabaseServiceClient();
  if (!sb) throw new Error("Customer service unavailable");
  const { data: result, error } = await sb.rpc("customer_address_command", {
    p_customer_id: customerId, p_action: action, p_id: id, p_data: data,
  });
  if (error) throw error;
  return result as CustomerAddress | null;
}
export function createCustomerAddress(customerId: string, input: unknown) {
  return command(customerId, "create", null, addressSchema.parse(input));
}
export function updateCustomerAddress(customerId: string, id: string, input: unknown) {
  return command(customerId, "update", id, addressSchema.partial().parse(input));
}
export async function deleteCustomerAddress(customerId: string, id: string) {
  return Boolean(await command(customerId, "delete", id));
}
export function setCustomerDefaultAddress(customerId: string, id: string) {
  return command(customerId, "default", id);
}
