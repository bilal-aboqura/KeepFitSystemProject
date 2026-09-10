import "server-only";

import {
  BostaIntegrationError,
  createBostaDelivery,
  createBostaPickup,
  downloadBostaAwb,
  getAvailableBostaPickupDates,
  listBostaPickupLocations,
  type BostaOrder,
  type BostaPickup,
} from "@/lib/bosta";
import { listBostaOrders, storeBostaShipment } from "@/lib/bosta-store";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export type PickupAutomationStatus = "running" | "completed" | "skipped" | "failed";

export interface StoredBostaPickup {
  automation_key: string;
  bosta_pickup_id: string | null;
  puid: string | null;
  scheduled_date: string | null;
  scheduled_time_slot: string | null;
  state: string | null;
  business_location_id: string | null;
  order_ids: string[];
  tracking_numbers: string[];
  parcel_count: number;
  telegram_sent: boolean;
  status: PickupAutomationStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const CAIRO_TIME_ZONE = "Africa/Cairo";
const MINIMUM_READY_ORDERS = 3;

export async function getLatestBostaPickups(limit = 5) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("bosta_pickups")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(25, limit)));
  if (error) {
    console.error("getLatestBostaPickups:", error.message);
    return [];
  }
  return (data ?? []) as StoredBostaPickup[];
}

async function claimPickup(automationKey: string, parcelCount: number) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("DB unavailable");
  const { data: existing } = await supabase
    .from("bosta_pickups")
    .select("status, updated_at")
    .eq("automation_key", automationKey)
    .maybeSingle();
  if (existing?.status === "completed") return false;
  if (
    existing?.status === "running" &&
    Date.now() - new Date(existing.updated_at).getTime() < 30 * 60 * 1000
  ) {
    return false;
  }
  const now = new Date().toISOString();
  const { error } = await supabase.from("bosta_pickups").upsert(
    {
      automation_key: automationKey,
      status: "running",
      parcel_count: parcelCount,
      error: null,
      updated_at: now,
      ...(existing ? {} : { created_at: now }),
    },
    { onConflict: "automation_key" },
  );
  if (error) throw error;
  return true;
}

async function updatePickup(automationKey: string, changes: Record<string, unknown>) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("DB unavailable");
  const { error } = await supabase
    .from("bosta_pickups")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("automation_key", automationKey);
  if (error) throw error;
}

function cairoClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAIRO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, hour: Number(value.hour) };
}

async function notifyTelegram(pickup: BostaPickup, orders: BostaOrder[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;

  const trackingNumbers = orders.map((order) => order.bosta?.trackingNumber).filter((value): value is string => Boolean(value));
  const awb = await downloadBostaAwb(trackingNumbers.join(","));
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append(
    "caption",
    `Bosta pickup ${pickup.scheduledDate}\n${orders.length} orders\n${orders.map((order) => order.order_number).join(", ")}`,
  );
  form.append(
    "document",
    new Blob([awb.slice().buffer as ArrayBuffer], { type: "application/pdf" }),
    `xeemo-bosta-${pickup.scheduledDate}.pdf`,
  );
  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Telegram API ${response.status}`);
  return true;
}

export async function runBostaPickupAutomation(options?: { ignoreTime?: boolean; now?: Date }) {
  const clock = cairoClock(options?.now);
  if (!options?.ignoreTime && clock.hour !== 0) {
    return { status: "outside-window" as const, cairoDate: clock.date };
  }

  const orders = await listBostaOrders();
  const candidates = orders.filter(
    (order) => order.fulfillment_status === "processing" && !order.bosta?.pickup?.id,
  );
  const automationKey = `daily-pickup:${clock.date}`;
  if (candidates.length < MINIMUM_READY_ORDERS) {
    const claimed = await claimPickup(automationKey, candidates.length);
    if (claimed) {
      await updatePickup(automationKey, {
        status: "skipped",
        parcel_count: candidates.length,
        error: `Waiting for at least ${MINIMUM_READY_ORDERS} processing orders.`,
      });
    }
    return {
      status: "below-minimum" as const,
      readyOrders: candidates.length,
      minimum: MINIMUM_READY_ORDERS,
    };
  }

  const claimed = await claimPickup(automationKey, candidates.length);
  if (!claimed) return { status: "already-ran" as const };

  try {
    const locations = await listBostaPickupLocations();
    const location = locations.find((item) => item.isDefault) ?? locations[0];
    if (!location) throw new BostaIntegrationError("لا يوجد مكان استلام في حساب Bosta.", 400);

    const readyOrders: BostaOrder[] = [];
    const creationErrors: string[] = [];
    for (const order of candidates) {
      try {
        const shipment = order.bosta ?? (await createBostaDelivery(order));
        const stored = await storeBostaShipment(order, shipment);
        if (stored) readyOrders.push(stored);
      } catch (error) {
        creationErrors.push(`${order.order_number}: ${error instanceof Error ? error.message : "Shipment failed"}`);
      }
    }
    if (readyOrders.length < MINIMUM_READY_ORDERS) {
      throw new BostaIntegrationError(`تم تجهيز ${readyOrders.length} شحنة فقط. ${creationErrors.join(" | ")}`, 400);
    }

    const dates = await getAvailableBostaPickupDates(7);
    const scheduledDate = dates[0];
    if (!scheduledDate) throw new BostaIntegrationError("Bosta لم ترسل أي تاريخ متاح للاستلام.");
    const trackingNumbers = readyOrders.map((order) => order.bosta!.trackingNumber);
    const pickup = await createBostaPickup({
      location,
      scheduledDate,
      trackingNumbers,
      hasBigItems: readyOrders.some(
        (order) => order.order_items.reduce((sum, item) => sum + item.quantity, 0) > 15,
      ),
      notes: process.env.BOSTA_PICKUP_NOTES ?? `Xeemo automatic pickup — ${readyOrders.length} orders`,
    });

    const updatedOrders: BostaOrder[] = [];
    for (const order of readyOrders) {
      const updated = await storeBostaShipment(order, {
        ...order.bosta!,
        pickup: {
          id: pickup.id,
          ...(pickup.puid ? { puid: pickup.puid } : {}),
          scheduledDate: pickup.scheduledDate,
          ...(pickup.scheduledTimeSlot ? { scheduledTimeSlot: pickup.scheduledTimeSlot } : {}),
        },
      });
      if (updated) updatedOrders.push(updated);
    }

    await updatePickup(automationKey, {
      bosta_pickup_id: pickup.id,
      puid: pickup.puid ?? null,
      scheduled_date: pickup.scheduledDate,
      scheduled_time_slot: pickup.scheduledTimeSlot ?? null,
      state: pickup.state,
      business_location_id: pickup.businessLocationId,
      order_ids: updatedOrders.map((order) => order.id),
      tracking_numbers: trackingNumbers,
      parcel_count: updatedOrders.length,
      status: "completed",
      telegram_sent: false,
      error: creationErrors.length ? creationErrors.join(" | ") : null,
    });

    try {
      const telegramSent = await notifyTelegram(pickup, updatedOrders);
      await updatePickup(automationKey, { telegram_sent: telegramSent });
    } catch (error) {
      await updatePickup(automationKey, {
        telegram_sent: false,
        error: [creationErrors.join(" | "), error instanceof Error ? error.message : "Telegram failed"].filter(Boolean).join(" | "),
      });
    }

    return {
      status: "scheduled" as const,
      pickupId: pickup.id,
      scheduledDate: pickup.scheduledDate,
      orders: updatedOrders.length,
    };
  } catch (error) {
    await updatePickup(automationKey, {
      status: "failed",
      error: error instanceof Error ? error.message : "Pickup automation failed",
    });
    throw error;
  }
}
