import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function listPricingAuditEvents(filters: { action?: string; customerId?: string; limit?: number } = {}) {
  const db = getSupabaseServiceClient();
  if (!db) return [];
  let query = db.from("pricing_audit_events").select("id,action,actor_id,entity_type,entity_id,customer_id,variant_id,sellable_unit_id,correlation_id,previous_state,new_state,reason,context,occurred_at").order("occurred_at", { ascending: false }).limit(Math.min(filters.limit ?? 100, 250));
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  const { data, error } = await query;
  if (error) throw new Error("Pricing audit history is unavailable");
  return data ?? [];
}
