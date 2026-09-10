import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCustomerForUser } from "./identity";
import type { Customer } from "./types";

export async function getCurrentCustomer(): Promise<Customer | null> {
  const sb = await getSupabaseServerClient();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  return user ? resolveCustomerForUser(user) : null;
}

export async function requireCurrentCustomer() {
  const customer = await getCurrentCustomer();
  if (!customer) throw new Error("UNAUTHENTICATED");
  return customer;
}
