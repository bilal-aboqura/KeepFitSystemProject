import "server-only";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Customer } from "./types";

export function isCustomerProfileComplete(customer: Pick<Customer, "full_name" | "phone">) {
  return Boolean(customer.full_name?.trim() && customer.phone && /^01[0125]\d{8}$/.test(customer.phone));
}

export async function resolveCustomerForUser(user: User): Promise<Customer | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data: existing } = await sb.from("customers").select("*").eq("auth_user_id", user.id).maybeSingle();
  if (existing) return existing as Customer;
  const metadata = user.user_metadata ?? {};
  const { data, error } = await sb.from("customers").insert({
    auth_user_id: user.id,
    email: user.email ?? null,
    full_name: typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : null,
  }).select("*").single();
  if (error) {
    const { data: raced } = await sb.from("customers").select("*").eq("auth_user_id", user.id).maybeSingle();
    return (raced as Customer | null) ?? null;
  }
  return data as Customer;
}
