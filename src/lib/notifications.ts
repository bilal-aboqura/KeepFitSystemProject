import type { OrderForConfirmation } from "@/lib/data/orders";
import { formatPrice } from "@/lib/utils";

const WHATSAPP_NUMBER = process.env.WHATSAPP_ALERT_NUMBER?.trim();
const SHEETS_WEBHOOK = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID?.trim();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^00/, "");
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("1")) return `20${digits}`;
  return digits;
}

function buildTelegramMessage(order: OrderForConfirmation): string {
  const payment =
    order.payment_method === "cod"
      ? "الدفع عند الاستلام"
      : "بطاقة بنكية (تم الدفع)";
  const customerPhone = phoneDigits(order.customer_phone);
  const adminUrl = SITE_URL
    ? `${SITE_URL}/admin/orders/${encodeURIComponent(order.id)}`
    : "";
  const items = order.order_items.slice(0, 15).map((item) => {
    const name = item.name_ar || item.name_en;
    const total = Number(item.price) * item.quantity;
    return `• ${escapeHtml(name.slice(0, 120))} × ${item.quantity} — ${formatPrice(total, "en")}`;
  });
  if (order.order_items.length > items.length) {
    items.push(`• و${order.order_items.length - items.length} منتجات أخرى`);
  }

  return [
    `🛒 <b>طلب جديد ${escapeHtml(order.order_number)}</b>`,
    "",
    `👤 <b>العميل:</b> ${escapeHtml(order.customer_name)}`,
    `📞 <b>التليفون:</b> <a href="tel:+${customerPhone}">${escapeHtml(order.customer_phone)}</a>`,
    order.alt_phone
      ? `📞 <b>تليفون إضافي:</b> ${escapeHtml(order.alt_phone)}`
      : "",
    `📍 <b>العنوان:</b> ${escapeHtml(`${order.governorate.slice(0, 100)}، ${order.city.slice(0, 100)} — ${order.address.slice(0, 500)}`)}`,
    `💳 <b>الدفع:</b> ${payment}`,
    order.notes
      ? `📝 <b>ملاحظات:</b> ${escapeHtml(order.notes.slice(0, 400))}`
      : "",
    "",
    "<b>المنتجات:</b>",
    ...items,
    "",
    `🚚 <b>الشحن:</b> ${formatPrice(Number(order.shipping_cost), "en")}`,
    `💰 <b>الإجمالي:</b> ${formatPrice(Number(order.grand_total), "en")}`,
    "",
    customerPhone
      ? `<a href="https://wa.me/${customerPhone}">مراسلة العميل على واتساب</a>`
      : "",
    adminUrl
      ? `<a href="${escapeHtml(adminUrl)}">فتح الطلب في لوحة التحكم</a>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildOwnerWhatsAppUrl(order: OrderForConfirmation): string {
  if (!WHATSAPP_NUMBER) return "";
  const lines = [
    `🛒 *New Xeemo Order ${order.order_number}*`,
    `Customer: ${order.customer_name}`,
    `Phone: ${order.customer_phone}`,
    `Address: ${order.city}, ${order.governorate} — ${order.address}`,
    `Payment: ${order.payment_method.toUpperCase()} (${order.payment_status})`,
    `Total: ${formatPrice(Number(order.grand_total), "en")}`,
    "",
    "Items:",
    ...order.order_items.map(
      (item) =>
        `• ${item.name_en} ×${item.quantity} = ${formatPrice(Number(item.price) * item.quantity, "en")}`,
    ),
  ];
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export async function sendTelegramOrderAlert(order: OrderForConfirmation) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: buildTelegramMessage(order),
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Telegram API ${response.status}: ${details.slice(0, 300)}`);
    }
  } catch (error) {
    console.error("Telegram order alert failed:", error);
  }
}

export async function mirrorOrderToSheets(order: OrderForConfirmation) {
  if (!SHEETS_WEBHOOK) return;
  const body = {
    name: order.customer_name,
    phone: order.customer_phone,
    secondPhone: order.alt_phone ?? "",
    gov: order.governorate,
    city: order.city,
    address: order.address,
    paymentMethod: order.payment_method,
    customerType: "New",
    orderSummary: order.order_items
      .map((item) => `${item.name_en} ×${item.quantity}`)
      .join("\n"),
    total: String(order.grand_total),
    orderNumber: order.order_number,
  };

  try {
    await fetch(SHEETS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error("Sheets mirror failed:", error);
  }
}

export async function sendNewOrderNotifications(order: OrderForConfirmation) {
  await Promise.all([
    sendTelegramOrderAlert(order),
    mirrorOrderToSheets(order),
  ]);
}
