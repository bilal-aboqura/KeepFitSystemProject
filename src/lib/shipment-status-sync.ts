import "server-only";

import {
  fulfillmentStatusForBostaState,
  getBostaConfiguration,
  syncBostaDelivery,
  type BostaOrder,
} from "@/lib/bosta";
import { listBostaOrders, storeBostaShipment } from "@/lib/bosta-store";
import {
  getMylerzConfiguration,
  orderStatusForMylerzStatus,
  syncMylerzShipment,
} from "@/lib/mylerz";
import { mylerzStatusKind } from "@/lib/mylerz-status";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type SyncResult = {
  checked: number;
  updated: number;
  skipped: number;
  failed: number;
};

function isFinalBostaState(stateCode: number) {
  return [45, 46, 48, 49, 60, 100, 101].includes(stateCode);
}

function isFinalMylerzStatus(status: string) {
  return ["delivered", "cancelled", "returned"].includes(mylerzStatusKind(status));
}

function result(): SyncResult {
  return { checked: 0, updated: 0, skipped: 0, failed: 0 };
}

export async function syncOpenShipmentStatuses() {
  const orders = await listBostaOrders();
  const bosta = result();

  if (getBostaConfiguration().ready) {
    for (const order of orders) {
      if (
        !order.bosta ||
        (isFinalBostaState(order.bosta.stateCode) &&
          fulfillmentStatusForBostaState(
            order.bosta.stateCode,
            order.fulfillment_status,
          ) === order.fulfillment_status)
      ) {
        bosta.skipped += 1;
        continue;
      }
      bosta.checked += 1;
      try {
        const shipment = await syncBostaDelivery(order.bosta);
        await storeBostaShipment(order, shipment);
        bosta.updated += 1;
      } catch (error) {
        bosta.failed += 1;
        console.error("Bosta shipment status sync failed", {
          orderId: order.id,
          trackingNumber: order.bosta.trackingNumber,
          error,
        });
      }
    }
  }

  return { bosta, mylerz: await syncMylerzStatuses(orders) };
}

export async function syncOpenMylerzShipmentStatuses() {
  return syncMylerzStatuses(await listBostaOrders());
}

async function syncMylerzStatuses(orders: BostaOrder[]) {
  const mylerz = result();
  if (!getMylerzConfiguration().ready) return mylerz;
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("DB unavailable");
  for (const order of orders) {
    if (
      !order.mylerz ||
      (isFinalMylerzStatus(order.mylerz.status) &&
        orderStatusForMylerzStatus(
          order.mylerz.status,
          order.fulfillment_status,
        ) === order.fulfillment_status)
    ) {
      mylerz.skipped += 1;
      continue;
    }
    mylerz.checked += 1;
    try {
      const shipment = await syncMylerzShipment(order.mylerz);
      const { error } = await supabase
        .from("orders")
        .update({
          mylerz: shipment,
          fulfillment_status: orderStatusForMylerzStatus(
            shipment.status,
            order.fulfillment_status,
          ),
          ...(mylerzStatusKind(shipment.status) === "delivered" &&
          order.payment_method === "cod"
            ? { payment_status: "paid" }
            : {}),
        })
        .eq("id", order.id)
        .is("bosta", null);
      if (error) throw error;
      mylerz.updated += 1;
    } catch (error) {
      mylerz.failed += 1;
      console.error("Mylerz shipment status sync failed", {
        orderId: order.id,
        trackingNumber: order.mylerz.trackingNumber,
        error,
      });
    }
  }
  return mylerz;
}
