import "server-only";

import {
  fulfillmentStatusForBostaState,
  listBostaDeliveriesForImport,
  syncBostaDelivery,
  type BostaOrder,
  type BostaShipment,
} from "@/lib/bosta";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const BOSTA_ORDER_SELECT =
  "id, order_number, customer_name, customer_phone, alt_phone, governorate, city, address, notes, items_total, grand_total, payment_method, payment_status, fulfillment_status, bosta, mylerz, order_items(name_en, name_ar, quantity)";

function asOrder(value: unknown) {
  return value as BostaOrder;
}

export async function getBostaOrderById(id: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("orders")
    .select(BOSTA_ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? asOrder(data) : null;
}

export async function getBostaOrderByReference(reference: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("orders")
    .select(BOSTA_ORDER_SELECT)
    .eq("order_number", reference)
    .maybeSingle();
  if (error) throw error;
  return data ? asOrder(data) : null;
}

export async function getBostaOrderByTrackingNumber(trackingNumber: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("orders")
    .select(BOSTA_ORDER_SELECT)
    .eq("bosta->>trackingNumber", trackingNumber)
    .maybeSingle();
  if (error) throw error;
  return data ? asOrder(data) : null;
}

export async function listBostaOrders() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orders")
    .select(BOSTA_ORDER_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(asOrder);
}

export async function storeBostaShipment(order: BostaOrder, shipment: BostaShipment) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;
  const fulfillmentStatus = fulfillmentStatusForBostaState(
    shipment.stateCode,
    order.fulfillment_status,
  );
  const { data, error } = await supabase
    .from("orders")
    .update({
      bosta: shipment,
      fulfillment_status: fulfillmentStatus,
      ...(shipment.stateCode === 45 && order.payment_method === "cod"
        ? { payment_status: "paid" }
        : {}),
    })
    .eq("id", order.id)
    .is("mylerz", null)
    .or("shipment_creation.is.null,shipment_creation.eq.bosta")
    .select(BOSTA_ORDER_SELECT)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Order is missing or linked to Mylerz");
  return data ? asOrder(data) : null;
}

function phoneKey(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("20") && digits.length === 12) return digits.slice(2);
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

function uniqueOrder(orders: BostaOrder[]) {
  return orders.length === 1 ? orders[0] : null;
}

export async function importExistingBostaDeliveries() {
  const [imports, orders] = await Promise.all([
    listBostaDeliveriesForImport(),
    listBostaOrders(),
  ]);
  const unmatchedTrackingNumbers: string[] = [];
  const ambiguousTrackingNumbers: string[] = [];
  const conflicts: string[] = [];
  let linked = 0;
  let refreshed = 0;

  for (const item of imports) {
    const trackingNumber = item.shipment.trackingNumber;
    let order = uniqueOrder(
      orders.filter((candidate) => candidate.bosta?.trackingNumber === trackingNumber),
    );
    let matchType: "existing" | "reference" | "phone" | null = order ? "existing" : null;

    if (!order) {
      const references = new Set(item.businessReferences.map((value) => value.trim().toLowerCase()));
      const matches = orders.filter((candidate) => references.has(candidate.order_number.toLowerCase()));
      order = uniqueOrder(matches);
      if (order) matchType = "reference";
      else if (matches.length > 1) {
        ambiguousTrackingNumbers.push(trackingNumber);
        continue;
      }
    }

    if (!order) {
      const phones = new Set(item.phones.map(phoneKey).filter(Boolean));
      const matches = orders.filter((candidate) =>
        [candidate.customer_phone, candidate.alt_phone]
          .map(phoneKey)
          .some((phone) => phone && phones.has(phone)),
      );
      order = uniqueOrder(matches);
      if (order) matchType = "phone";
      else if (matches.length > 1) {
        ambiguousTrackingNumbers.push(trackingNumber);
        continue;
      }
    }

    if (!order) {
      unmatchedTrackingNumbers.push(trackingNumber);
      continue;
    }
    if (order.mylerz?.trackingNumber || (order.bosta?.trackingNumber && order.bosta.trackingNumber !== trackingNumber)) {
      conflicts.push(trackingNumber);
      continue;
    }

    const baseShipment = {
      ...item.shipment,
      ...(order.bosta?.pickup ? { pickup: order.bosta.pickup } : {}),
    };
    const shipment = await syncBostaDelivery(baseShipment).catch(() => baseShipment);
    await storeBostaShipment(order, shipment);
    if (matchType === "existing") refreshed += 1;
    else linked += 1;
  }

  return {
    foundInBosta: imports.length,
    linked,
    refreshed,
    unmatchedTrackingNumbers,
    ambiguousTrackingNumbers,
    conflicts,
  };
}
