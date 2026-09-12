import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const PRICING_EVENT_NAMES = {
  listChanged: "PRICE_LIST_CHANGED",
  entryScheduled: "PRICE_ENTRY_SCHEDULED",
  customerListAssigned: "CUSTOMER_PRICE_LIST_ASSIGNED",
  customerOverrideChanged: "CUSTOMER_PRICE_OVERRIDE_CHANGED",
  defaultListChanged: "DEFAULT_PRICE_LIST_CHANGED",
  customerTypeMapped: "CUSTOMER_TYPE_PRICE_LIST_MAPPED",
} as const;

export type PricingEventName = typeof PRICING_EVENT_NAMES[keyof typeof PRICING_EVENT_NAMES];

export interface PricingAuditEventInput {
  action: PricingEventName;
  actorId: string;
  entityType: string;
  entityId?: string | null;
  customerId?: string | null;
  variantId?: string | null;
  sellableUnitId?: string | null;
  correlationId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  reason?: string | null;
  context?: Record<string, unknown>;
}

export async function persistPricingAuditEvent(input: PricingAuditEventInput) {
  const db = getSupabaseServiceClient();
  if (!db) throw new Error("Pricing audit is unavailable");
  const { data, error } = await db.from("pricing_audit_events").insert({
    action: input.action,
    actor_id: input.actorId,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    customer_id: input.customerId ?? null,
    variant_id: input.variantId ?? null,
    sellable_unit_id: input.sellableUnitId ?? null,
    correlation_id: input.correlationId,
    previous_state: input.previousState ?? null,
    new_state: input.newState ?? null,
    reason: input.reason ?? null,
    context: input.context ?? {},
  }).select("id").single();
  if (error) throw new Error("Pricing audit could not be recorded");
  return data.id as string;
}
