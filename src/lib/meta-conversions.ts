import "server-only";

import { createHash } from "node:crypto";

interface MetaOrderItem {
  product_id: string | null;
  price: number;
  quantity: number;
}

interface PurchaseOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  governorate: string;
  city: string;
  grand_total: number;
  order_items: MetaOrderItem[] | null;
}

interface CancelledOrder {
  id: string;
  order_number: string;
  customer_phone: string;
  grand_total: number;
  order_items: MetaOrderItem[] | null;
}

const pixelId =
  process.env.META_PIXEL_ID ??
  process.env.NEXT_PUBLIC_META_PIXEL_ID ??
  "1531675262043662";
const accessToken = process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
const graphVersion = process.env.META_GRAPH_API_VERSION ?? "v23.0";

function sha256(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizeEgyptPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^00/, "");
  return digits.startsWith("0") ? `20${digits.slice(1)}` : digits;
}

export async function sendPurchaseOrderToMeta(order: PurchaseOrder) {
  if (!accessToken) return { sent: false, reason: "not_configured" as const };

  const contents = (order.order_items ?? [])
    .filter((item) => item.product_id)
    .map((item) => ({
      id: item.product_id as string,
      quantity: item.quantity,
      item_price: Number(item.price),
    }));
  const names = order.customer_name.trim().split(/\s+/);
  const userData: Record<string, string[]> = {
    ph: [sha256(normalizeEgyptPhone(order.customer_phone))],
    fn: [sha256(names[0] ?? order.customer_name)],
    ct: [sha256(order.city)],
    st: [sha256(order.governorate)],
    country: [sha256("eg")],
    external_id: [sha256(order.id)],
  };
  if (names.length > 1) userData.ln = [sha256(names.slice(1).join(" "))];

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${pixelId}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            event_name: "Purchase",
            event_time: Math.floor(Date.now() / 1000),
            event_id: order.order_number,
            action_source: "website",
            event_source_url: process.env.NEXT_PUBLIC_SITE_URL,
            user_data: userData,
            custom_data: {
              currency: "EGP",
              value: Number(order.grand_total),
              order_id: order.order_number,
              content_type: "product",
              content_ids: contents.map((item) => item.id),
              contents,
            },
          },
        ],
        access_token: accessToken,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Meta CAPI Purchase ${response.status}: ${details.slice(0, 300)}`);
  }

  return { sent: true, reason: null };
}

export async function sendCancelledOrderToMeta(order: CancelledOrder) {
  if (!accessToken) return;

  const contents = (order.order_items ?? [])
    .filter((item) => item.product_id)
    .map((item) => ({
      id: item.product_id as string,
      quantity: item.quantity,
      item_price: Number(item.price),
    }));

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${pixelId}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            event_name: "OrderCancelled",
            event_time: Math.floor(Date.now() / 1000),
            event_id: `${order.id}:cancelled`,
            action_source: "website",
            event_source_url: process.env.NEXT_PUBLIC_SITE_URL,
            user_data: { ph: [sha256(order.customer_phone.replace(/\D/g, ""))] },
            custom_data: {
              currency: "EGP",
              value: Number(order.grand_total),
              order_id: order.order_number,
              content_type: "product",
              content_ids: contents.map((item) => item.id),
              contents,
            },
          },
        ],
        access_token: accessToken,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    console.error("Meta CAPI cancelled-order event failed:", response.status);
  }
}
