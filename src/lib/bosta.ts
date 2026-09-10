import "server-only";

import { getBostaStateMeta } from "@/lib/bosta-status";

const BOSTA_API_URL = "https://app.bosta.co/api/v2";
const EGYPT_COUNTRY_ID = "60e4482c7cb7d4bc4849c4d5";

export const BOSTA_WEBHOOK_HEADER = "x-xeemo-bosta-webhook";

export interface BostaShipment {
  deliveryId: string;
  trackingNumber: string;
  stateCode: number;
  stateValue?: string;
  dashboardState?: string;
  type?: string;
  stateUpdatedAt: string;
  deliveryPromiseDate?: string;
  exceptionReason?: string;
  exceptionCode?: number;
  numberOfAttempts?: number;
  timeline?: Array<{
    value: string;
    nextAction?: string;
    done: boolean;
    date?: string;
  }>;
  pickup?: {
    id: string;
    puid?: string;
    scheduledDate: string;
    scheduledTimeSlot?: string;
  };
}

export interface BostaOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  alt_phone: string;
  governorate: string;
  city: string;
  address: string;
  notes: string | null;
  items_total: number;
  grand_total: number;
  payment_method: "card" | "cod";
  fulfillment_status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";
  bosta: BostaShipment | null;
  mylerz: import("@/lib/mylerz").MylerzShipment | null;
  payment_status: string;
  order_items: Array<{
    name_en: string;
    name_ar: string | null;
    quantity: number;
  }>;
}

export interface BostaPickupLocation {
  _id: string;
  locationName?: string;
  isDefault?: boolean;
  contactPerson?: {
    name?: string;
    phone?: string;
    secPhone?: string;
    email?: string;
  };
  contacts?: Array<{
    name?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    isDefault?: boolean;
  }>;
}

export interface BostaPickup {
  id: string;
  puid?: string;
  scheduledDate: string;
  scheduledTimeSlot?: string;
  state: string;
  businessLocationId: string;
}

export interface BostaWebhookPayload {
  _id?: unknown;
  trackingNumber?: unknown;
  state?: unknown;
  timeStamp?: unknown;
  deliveryPromiseDate?: unknown;
  exceptionReason?: unknown;
  exceptionCode?: unknown;
  businessReference?: unknown;
  numberOfAttempts?: unknown;
  type?: unknown;
}

interface BostaResponse<T> {
  success?: boolean;
  message?: string;
  errorCode?: number | string;
  data?: T;
}

interface BostaDeliveryData {
  _id?: string;
  trackingNumber?: string | number;
  businessReference?: string;
  uniqueBusinessReference?: string;
  state?: number | { code?: number; value?: string };
  maskedState?: string;
  type?: string | { code?: number; value?: string };
  receiver?: {
    phone?: string;
    secondPhone?: string;
    fullName?: string;
  };
  updatedAt?: string;
  creationTimestamp?: number;
  deliveryPromiseDate?: string;
  exceptionReason?: string;
  exceptionCode?: number;
  numberOfAttempts?: number;
  deliveryAttemptsLength?: number;
  timeline?: Array<{
    value?: string;
    nextAction?: string;
    done?: boolean;
    date?: string;
  }>;
}

interface BostaCity {
  _id: string;
  name: string;
  code: string;
  dropOffAvailability?: boolean;
}

interface BostaDistrict {
  zoneId: string;
  zoneName: string;
  zoneOtherName?: string;
  districtId: string;
  districtName: string;
  districtOtherName?: string;
  dropOffAvailability?: boolean;
}

export interface BostaDeliveryImport {
  shipment: BostaShipment;
  businessReferences: string[];
  phones: string[];
}

const governorateCodes = new Map<string, string>([
  ["القاهره", "EG-01"], ["cairo", "EG-01"],
  ["الاسكندريه", "EG-02"], ["alexandria", "EG-02"],
  ["البحيره", "EG-04"], ["beheira", "EG-04"],
  ["الدقهليه", "EG-05"], ["dakahlia", "EG-05"],
  ["القليوبيه", "EG-06"], ["qalyubia", "EG-06"],
  ["الغربيه", "EG-07"], ["gharbia", "EG-07"],
  ["كفرالشيخ", "EG-08"], ["kafrelsheikh", "EG-08"],
  ["المنوفيه", "EG-09"], ["monufia", "EG-09"],
  ["الشرقيه", "EG-10"], ["sharqia", "EG-10"],
  ["الاسماعيليه", "EG-11"], ["ismailia", "EG-11"],
  ["السويس", "EG-12"], ["suez", "EG-12"],
  ["بورسعيد", "EG-13"], ["portsaid", "EG-13"],
  ["دمياط", "EG-14"], ["damietta", "EG-14"],
  ["الفيوم", "EG-15"], ["faiyum", "EG-15"],
  ["بنيسويف", "EG-16"], ["benisuef", "EG-16"],
  ["اسيوط", "EG-17"], ["asyut", "EG-17"],
  ["سوهاج", "EG-18"], ["sohag", "EG-18"],
  ["المنيا", "EG-19"], ["minya", "EG-19"],
  ["قنا", "EG-20"], ["qena", "EG-20"],
  ["اسوان", "EG-21"], ["aswan", "EG-21"],
  ["الاقصر", "EG-22"], ["luxor", "EG-22"],
  ["البحرالاحمر", "EG-23"], ["redsea", "EG-23"],
  ["الواديالجديد", "EG-24"], ["newvalley", "EG-24"],
  ["الجيزه", "EG-25"], ["giza", "EG-25"],
  ["جنوبسيناء", "EG-26"], ["southsinai", "EG-26"],
  ["شمالسيناء", "EG-27"], ["northsinai", "EG-27"],
  ["مطروح", "EG-28"], ["matrouh", "EG-28"],
]);

export class BostaIntegrationError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "BostaIntegrationError";
  }
}

function normalized(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

export function getBostaConfiguration() {
  const apiKey = process.env.BOSTA_API_KEY?.trim() ?? "";
  const webhookSecret = process.env.BOSTA_WEBHOOK_SECRET?.trim() ?? "";
  const origin = siteOrigin();
  const publicSite = !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  return {
    apiKey,
    webhookSecret,
    webhookUrl: `${origin}/api/webhooks/bosta`,
    publicSite,
    ready: Boolean(apiKey && webhookSecret && publicSite),
  };
}

function requiredConfiguration() {
  const configuration = getBostaConfiguration();
  if (!configuration.ready) {
    throw new BostaIntegrationError(
      "إعداد Bosta غير مكتمل. أضف مفتاح API ومفتاح Webhook ورابط الموقع العام.",
      503,
    );
  }
  return configuration;
}

function bostaErrorMessage(result: BostaResponse<unknown>, status: number) {
  const known: Record<string, string> = {
    "1073": "أضف عنوان استلام افتراضي لحسابك في Bosta أولًا.",
    "3001": "المحافظة غير موجودة في مناطق Bosta.",
    "3002": "المنطقة غير موجودة في مناطق Bosta.",
    "3003": "الحي غير موجود في مناطق Bosta.",
    "3007": "قيمة التحصيل تتجاوز الحد المسموح في Bosta.",
    "1077": "مكان الاستلام في Bosta يحتاج جهة اتصال افتراضية.",
    "1078": "يوجد طلب استلام آخر لنفس المكان والتاريخ.",
    "1080": "Bosta لا تقبل جدولة الاستلام يوم الجمعة.",
    "1081": "انتهى وقت قبول طلبات الاستلام لهذا اليوم.",
    "1083": "لا يمكن جدولة الاستلام في تاريخ سابق.",
    "2022": "التاريخ المحدد إجازة لدى Bosta.",
    "2027": "تم إنشاء طلب استلام بالفعل اليوم.",
  };
  const translated = result.errorCode ? known[String(result.errorCode)] : undefined;
  const code = result.errorCode ? ` (${result.errorCode})` : "";
  return `${translated ?? result.message ?? `رفضت Bosta الطلب برمز ${status}.`}${code}`;
}

async function bostaJson<T>(path: string, options: RequestInit = {}, authenticated = true) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (authenticated) headers.set("Authorization", requiredConfiguration().apiKey);

  let response: Response;
  try {
    response = await fetch(`${BOSTA_API_URL}${path}`, {
      ...options,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new BostaIntegrationError("تعذر الاتصال بـ Bosta حاليًا. حاول مرة أخرى.");
  }

  let result: BostaResponse<T>;
  try {
    result = (await response.json()) as BostaResponse<T>;
  } catch {
    throw new BostaIntegrationError("وصل رد غير صالح من Bosta.");
  }
  if (!response.ok || result.success === false || result.data === undefined) {
    throw new BostaIntegrationError(
      bostaErrorMessage(result, response.status),
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }
  return result.data;
}

function findDistrict(districts: BostaDistrict[], names: string[]) {
  const candidates = names.filter(Boolean).map(normalized);
  const available = districts.filter((district) => district.dropOffAvailability !== false);
  return (
    available.find((district) =>
      [district.districtName, district.districtOtherName ?? ""].some((name) =>
        candidates.includes(normalized(name)),
      ),
    ) ??
    available.find((district) =>
      [district.districtName, district.districtOtherName ?? "", district.zoneName, district.zoneOtherName ?? ""].some((name) => {
        const districtName = normalized(name);
        return districtName.length >= 4 && candidates.some((candidate) => candidate.includes(districtName) || districtName.includes(candidate));
      }),
    )
  );
}

async function getBostaAddress(order: BostaOrder) {
  const code = governorateCodes.get(normalized(order.governorate));
  if (!code) {
    throw new BostaIntegrationError(`المحافظة «${order.governorate}» غير مربوطة بمناطق Bosta.`, 400);
  }
  const cities = await bostaJson<{ list: BostaCity[] }>(
    `/cities?countryId=${EGYPT_COUNTRY_ID}`,
    {},
    false,
  );
  const city = cities.list.find((item) => item.code === code && item.dropOffAvailability !== false);
  if (!city) {
    throw new BostaIntegrationError(`Bosta لا تستقبل شحنات إلى «${order.governorate}» حاليًا.`, 400);
  }
  const districts = await bostaJson<BostaDistrict[]>(
    `/cities/${encodeURIComponent(city._id)}/districts`,
    {},
    false,
  );
  const district = findDistrict(districts, [order.city, order.address]);
  if (!district) {
    throw new BostaIntegrationError(`تعذر مطابقة منطقة «${order.city}» مع مناطق Bosta.`, 400);
  }
  return {
    city: city.name,
    cityId: city._id,
    districtId: district.districtId,
    zoneId: district.zoneId,
    firstLine: order.address,
    isWorkAddress: false,
  };
}

function egyptianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("20") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith("1") && digits.length === 10) return `0${digits}`;
  return digits;
}

function shipmentFromDelivery(delivery: BostaDeliveryData, existing?: BostaShipment): BostaShipment {
  const stateCode = typeof delivery.state === "number"
    ? delivery.state
    : Number(delivery.state?.code ?? existing?.stateCode ?? 10);
  const definition = getBostaStateMeta(stateCode);
  const timestamp = delivery.updatedAt
    ? new Date(delivery.updatedAt).toISOString()
    : delivery.creationTimestamp
      ? new Date(delivery.creationTimestamp).toISOString()
      : new Date().toISOString();

  return {
    deliveryId: String(delivery._id ?? existing?.deliveryId ?? ""),
    trackingNumber: String(delivery.trackingNumber ?? existing?.trackingNumber ?? ""),
    stateCode,
    stateValue:
      typeof delivery.state === "object" && delivery.state?.value
        ? delivery.state.value
        : existing?.stateValue ?? definition.value,
    dashboardState: delivery.maskedState ?? existing?.dashboardState ?? definition.dashboard,
    stateUpdatedAt: timestamp,
    ...(delivery.type
      ? { type: typeof delivery.type === "string" ? delivery.type : delivery.type.value ?? String(delivery.type.code ?? "") }
      : existing?.type ? { type: existing.type } : {}),
    ...(delivery.deliveryPromiseDate
      ? { deliveryPromiseDate: delivery.deliveryPromiseDate }
      : existing?.deliveryPromiseDate ? { deliveryPromiseDate: existing.deliveryPromiseDate } : {}),
    ...(delivery.exceptionReason ? { exceptionReason: delivery.exceptionReason } : {}),
    ...(typeof delivery.exceptionCode === "number" ? { exceptionCode: delivery.exceptionCode } : {}),
    ...(typeof delivery.numberOfAttempts === "number"
      ? { numberOfAttempts: delivery.numberOfAttempts }
      : typeof delivery.deliveryAttemptsLength === "number"
        ? { numberOfAttempts: delivery.deliveryAttemptsLength }
        : existing?.numberOfAttempts !== undefined ? { numberOfAttempts: existing.numberOfAttempts } : {}),
    ...(Array.isArray(delivery.timeline)
      ? {
          timeline: delivery.timeline
            .filter((item) => typeof item.value === "string")
            .map((item) => ({
              value: item.value as string,
              done: Boolean(item.done),
              ...(item.nextAction ? { nextAction: item.nextAction } : {}),
              ...(item.date ? { date: item.date } : {}),
            })),
        }
      : existing?.timeline ? { timeline: existing.timeline } : {}),
    ...(existing?.pickup ? { pickup: existing.pickup } : {}),
  };
}

export async function createBostaDelivery(order: BostaOrder) {
  if (order.mylerz?.trackingNumber) throw new BostaIntegrationError("الطلب مربوط بشحنة Mylerz بالفعل.", 409);
  if (order.bosta?.trackingNumber) {
    throw new BostaIntegrationError("الطلب مربوط بشحنة Bosta بالفعل.", 409);
  }
  if (order.fulfillment_status === "cancelled") {
    throw new BostaIntegrationError("لا يمكن إنشاء شحنة لطلب ملغي.", 400);
  }

  const configuration = requiredConfiguration();
  const dropOffAddress = await getBostaAddress(order);
  const itemCount = order.order_items.reduce((total, item) => total + item.quantity, 0);
  const description = order.order_items
    .map((item) => `${item.name_en} × ${item.quantity}`)
    .join("، ")
    .slice(0, 200);
  const names = order.customer_name.trim().split(/\s+/);
  const delivery = await bostaJson<BostaDeliveryData>("/deliveries?apiVersion=1", {
    method: "POST",
    body: JSON.stringify({
      type: 10,
      specs: {
        packageType: "Parcel",
        size: itemCount <= 5 ? "SMALL" : itemCount <= 15 ? "MEDIUM" : "LARGE",
        packageDetails: { itemsCount: itemCount, description },
      },
      goodsInfo: { amount: Number(order.items_total) },
      notes: [order.order_number, order.notes].filter(Boolean).join(" — ").slice(0, 200),
      cod: order.payment_method === "cod" ? Number(order.grand_total) : 0,
      dropOffAddress,
      businessReference: order.order_number,
      uniqueBusinessReference: order.order_number,
      receiver: {
        firstName: names[0] || order.customer_name,
        lastName: names.slice(1).join(" "),
        fullName: order.customer_name,
        phone: egyptianPhone(order.customer_phone),
        secondPhone: egyptianPhone(order.alt_phone),
      },
      webhookUrl: configuration.webhookUrl,
      webhookCustomHeaders: { [BOSTA_WEBHOOK_HEADER]: configuration.webhookSecret },
    }),
  });
  const shipment = shipmentFromDelivery(delivery);
  if (!shipment.deliveryId || !shipment.trackingNumber) {
    throw new BostaIntegrationError("تم إنشاء الشحنة لكن Bosta لم ترسل رقم التتبع.");
  }
  return syncBostaDelivery(shipment).catch(() => shipment);
}

export async function syncBostaDelivery(shipment: BostaShipment) {
  const delivery = await bostaJson<BostaDeliveryData>(
    `/deliveries/business/${encodeURIComponent(shipment.trackingNumber)}`,
  );
  return shipmentFromDelivery(delivery, shipment);
}

export function shipmentFromWebhook(payload: BostaWebhookPayload, existing?: BostaShipment) {
  const timestamp = Number(payload.timeStamp);
  return shipmentFromDelivery(
    {
      _id: typeof payload._id === "string" ? payload._id : undefined,
      trackingNumber:
        typeof payload.trackingNumber === "string" || typeof payload.trackingNumber === "number"
          ? payload.trackingNumber
          : undefined,
      state: Number(payload.state),
      updatedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined,
      deliveryPromiseDate: typeof payload.deliveryPromiseDate === "string" ? payload.deliveryPromiseDate : undefined,
      exceptionReason: typeof payload.exceptionReason === "string" ? payload.exceptionReason : undefined,
      exceptionCode: typeof payload.exceptionCode === "number" ? payload.exceptionCode : undefined,
      numberOfAttempts: typeof payload.numberOfAttempts === "number" ? payload.numberOfAttempts : undefined,
      type: typeof payload.type === "string" ? payload.type : undefined,
    },
    existing,
  );
}

export function fulfillmentStatusForBostaState(
  stateCode: number,
  current: BostaOrder["fulfillment_status"],
): BostaOrder["fulfillment_status"] {
  if (stateCode === 45) return "delivered";
  if ([46, 60].includes(stateCode)) return "returned";
  if ([48, 49, 100, 101].includes(stateCode)) return "cancelled";
  if (stateCode === 10) return current === "pending" ? "processing" : current;
  if ([104, 105].includes(stateCode)) return current;
  return ["delivered", "cancelled", "returned"].includes(current) ? current : "shipped";
}

export async function listBostaDeliveriesForImport() {
  const imports: BostaDeliveryImport[] = [];
  const limit = 100;
  for (let page = 1; page <= 100; page += 1) {
    const result = await bostaJson<{ deliveries?: BostaDeliveryData[] }>("/deliveries/search", {
      method: "POST",
      body: JSON.stringify({ page, limit }),
    });
    const deliveries = result.deliveries ?? [];
    for (const delivery of deliveries) {
      const shipment = shipmentFromDelivery(delivery);
      if (!shipment.deliveryId || !shipment.trackingNumber) continue;
      imports.push({
        shipment,
        businessReferences: [delivery.businessReference, delivery.uniqueBusinessReference].filter((value): value is string => Boolean(value?.trim())),
        phones: [delivery.receiver?.phone, delivery.receiver?.secondPhone].filter((value): value is string => Boolean(value?.trim())),
      });
    }
    if (deliveries.length < limit) break;
  }
  return imports;
}

export async function listBostaPickupLocations() {
  const data = await bostaJson<{ list?: BostaPickupLocation[] }>("/pickup-locations");
  return data.list ?? [];
}

export async function getAvailableBostaPickupDates(days = 7) {
  const dates = await bostaJson<string[]>(`/pickups/available-dates?days=${Math.max(1, Math.min(30, days))}`);
  return dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
}

export async function createBostaPickup(input: {
  location: BostaPickupLocation;
  scheduledDate: string;
  trackingNumbers: string[];
  hasBigItems: boolean;
  notes?: string;
}) {
  const defaultContact = input.location.contacts?.find((contact) => contact.isDefault) ?? input.location.contacts?.[0];
  const contactName = [defaultContact?.firstName, defaultContact?.lastName].filter(Boolean).join(" ");
  const name = input.location.contactPerson?.name || contactName || defaultContact?.name;
  const phone = input.location.contactPerson?.phone ?? defaultContact?.phone ?? "";
  if (!name || !phone) {
    throw new BostaIntegrationError("مكان الاستلام الافتراضي في Bosta لا يحتوي على جهة اتصال ورقم هاتف.", 400);
  }

  const pickup = await bostaJson<{
    _id?: string;
    puid?: string;
    scheduledTimeSlot?: string;
    state?: string;
    businessLocationId?: string;
  }>("/pickups", {
    method: "POST",
    body: JSON.stringify({
      businessLocationId: input.location._id,
      scheduledDate: input.scheduledDate,
      contactPerson: {
        name,
        phone,
        secPhone: input.location.contactPerson?.secPhone,
        email: input.location.contactPerson?.email ?? defaultContact?.email,
      },
      notes: input.notes?.slice(0, 500) || "Xeemo confirmed orders",
      numberOfParcels: input.trackingNumbers.length,
      packageType: "Normal",
      hasFragileItems: process.env.BOSTA_PICKUP_HAS_FRAGILE_ITEMS === "true",
      hasBigItems: input.hasBigItems,
      trackingNumbers: input.trackingNumbers,
    }),
  });
  if (!pickup._id) throw new BostaIntegrationError("تم إرسال طلب الاستلام لكن Bosta لم ترسل رقمه.");
  return {
    id: pickup._id,
    ...(pickup.puid ? { puid: pickup.puid } : {}),
    scheduledDate: input.scheduledDate,
    ...(pickup.scheduledTimeSlot ? { scheduledTimeSlot: pickup.scheduledTimeSlot } : {}),
    state: pickup.state ?? "Requested",
    businessLocationId: pickup.businessLocationId ?? input.location._id,
  } satisfies BostaPickup;
}

export async function downloadBostaAwb(trackingNumbers: string) {
  const response = await fetch(`${BOSTA_API_URL}/deliveries/mass-awb`, {
    method: "POST",
    headers: {
      Authorization: requiredConfiguration().apiKey,
      Accept: "application/pdf, application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trackingNumbers, requestedAwbType: "A4", lang: "ar" }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "";
  if (response.ok && contentType.includes("application/pdf")) return bytes;

  const text = new TextDecoder().decode(bytes);
  let result: BostaResponse<unknown> = {};
  try {
    result = JSON.parse(text) as BostaResponse<unknown>;
  } catch {
    result = {};
  }
  if (!response.ok || result.success === false) {
    throw new BostaIntegrationError(
      bostaErrorMessage(result, response.status),
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }
  const data = result.data;
  const candidate = typeof data === "string"
    ? data
    : data && typeof data === "object"
      ? Object.values(data as Record<string, unknown>).find((value) => typeof value === "string" && value.length > 100)
      : text;
  if (typeof candidate !== "string") throw new BostaIntegrationError("تعذر قراءة بوليصة الشحن من رد Bosta.");
  const pdf = Uint8Array.from(Buffer.from(candidate.replace(/^data:application\/pdf;base64,/, "").trim(), "base64"));
  if (pdf.length < 4 || new TextDecoder().decode(pdf.slice(0, 4)) !== "%PDF") {
    throw new BostaIntegrationError("رد Bosta لا يحتوي على بوليصة PDF صالحة.");
  }
  return pdf;
}
