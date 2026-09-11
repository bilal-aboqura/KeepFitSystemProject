import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { Lang } from "@/lib/i18n/translations";
import type {
  CustomerType,
  CustomerTypeCode,
  CustomerTypeCommandError,
} from "./types";

export function isProtectedCustomerType(code: CustomerTypeCode) {
  return code === "wholesale" || code === "gym_owner";
}

export function getBusinessNameLabel(code: CustomerTypeCode, lang: Lang) {
  if (code === "gym_owner") return lang === "ar" ? "اسم الجيم" : "Gym name";
  return lang === "ar" ? "الاسم التجاري / اسم النشاط" : "Trading / business name";
}

export function mapCustomerTypeDatabaseError(error: unknown): CustomerTypeCommandError {
  const value = error as { code?: string; message?: string } | null;
  const message = value?.message ?? "";
  if (value?.code === "42501" || message.includes("UNAUTHORIZED")) return "unauthorized";
  if (value?.code === "P0002" || message.includes("NOT_FOUND")) return "not_found";
  if (
    value?.code === "23505" ||
    value?.code === "40001" ||
    message.includes("PENDING_REQUEST") ||
    message.includes("ALREADY_EFFECTIVE") ||
    message.includes("NOT_PENDING")
  ) return "conflict";
  if (value?.code === "22023" || message.includes("INVALID") || message.includes("TYPE_")) return "validation";
  return "unavailable";
}

export function customerTypeErrorStatus(error: CustomerTypeCommandError) {
  if (error === "unauthorized") return 403;
  if (error === "not_found") return 404;
  if (error === "validation") return 422;
  if (error === "conflict") return 409;
  return 503;
}

export async function listCustomerTypes(options: { activeOnly?: boolean } = {}): Promise<CustomerType[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  let query = sb
    .from("customer_types")
    .select("id, code, name_ar, name_en, requires_approval, is_active, sort_order")
    .order("sort_order", { ascending: true });
  if (options.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as CustomerType[];
}

export async function listActiveCustomerTypes() {
  return listCustomerTypes({ activeOnly: true });
}

export async function getEffectiveCustomerType(customerId: string): Promise<CustomerType | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data: customer } = await sb
    .from("customers")
    .select("customer_type_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer?.customer_type_id) return null;
  const { data } = await sb
    .from("customer_types")
    .select("id, code, name_ar, name_en, requires_approval, is_active, sort_order")
    .eq("id", customer.customer_type_id)
    .maybeSingle();
  return (data as CustomerType | null) ?? null;
}
