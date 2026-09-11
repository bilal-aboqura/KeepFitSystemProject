import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveCustomerForUser } from "./identity";
import type { Customer } from "./types";
import { redirect } from "next/navigation";
import { cache } from "react";

export const getCurrentCustomer = cache(async (): Promise<Customer | null> => {
  const sb = await getSupabaseServerClient();
  if (!sb) return null;
  const { data: { user }, error } = await sb.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError" && error.status !== 400 && error.status !== 401 && error.status !== 403) throw new Error("Authentication unavailable");
  if (!user) return null;
  const { data, error: lookupError } = await sb.from("customers").select("id,auth_user_id,full_name,email,phone,created_at,updated_at").eq("auth_user_id",user.id).maybeSingle();
  if (lookupError) throw new Error("Customer service unavailable");
  return data ? data as Customer : resolveCustomerForUser(user);
});

export async function requireCurrentCustomer() {
  const customer = await getCurrentCustomer();
  if (!customer) throw new Error("UNAUTHENTICATED");
  return customer;
}

export async function requireCustomerPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/sign-in");
  return customer;
}
