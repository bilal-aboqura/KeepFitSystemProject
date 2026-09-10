import "server-only";

import type { BostaOrder as StoredOrder } from "@/lib/bosta";
import { mylerzStatusKind } from "@/lib/mylerz-status";
export interface MylerzShipment {
  trackingNumber: string;
  status: string;
  statusUpdatedAt: string;
  pickupOrderCode?: string;
  timeline?: { status: string; changedAt?: string }[];
}
type OrderStatus = StoredOrder["fulfillment_status"];
export { mylerzStatusLabel } from "@/lib/mylerz-status";

type MylerzResponse<T> = {
  Value?: T;
  IsErrorState?: boolean;
  ErrorDescription?: string | null;
  ErrorMetadata?: unknown;
};

type MylerzToken = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type MylerzCity = {
  Code?: string;
  ArName?: string;
  EnName?: string;
  Zones?: Array<{ Code?: string; ArName?: string; EnName?: string }>;
};

type MylerzPackage = {
  BarCode?: string | number;
  Status?: string;
  ErrorCode?: string | number | null;
  ErrorMessage?: string | null;
};

type MylerzAddOrder = {
  PickupOrderCode?: string | number;
  Packages?: MylerzPackage[];
  ErrorCode?: string | number | null;
  ErrorMessage?: string | null;
};

type MylerzTrack = {
  Barcode?: string | number;
  TrackLog?: Array<{
    StatusArName?: string;
    StatusEnName?: string;
    ChangedDate?: string;
  }>;
};

const DEFAULT_API_URL = "https://integration.mylerz.net";
let tokenCache: { value: string; expiresAt: number } | null = null;
let zonesCache: { value: MylerzCity[]; expiresAt: number } | null = null;

export class MylerzIntegrationError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "MylerzIntegrationError";
  }
}

export function getMylerzConfiguration() {
  const apiUrl = (
    process.env.MYLERZ_API_URL?.trim() || DEFAULT_API_URL
  ).replace(/\/$/, "");
  const username = process.env.MYLERZ_USERNAME?.trim() ?? "";
  const password = process.env.MYLERZ_PASSWORD ?? "";
  const warehouseName = process.env.MYLERZ_WAREHOUSE_NAME?.trim() ?? "";
  const parsedWeight = Number(process.env.MYLERZ_DEFAULT_WEIGHT_KG ?? "1");
  return {
    apiUrl,
    username,
    password,
    warehouseName,
    defaultWeightKg:
      Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1,
    ready: Boolean(username && password),
  };
}

function requiredConfiguration() {
  const configuration = getMylerzConfiguration();
  if (!configuration.ready) {
    throw new MylerzIntegrationError(
      "إعداد Mylerz غير مكتمل. أضف اسم المستخدم وكلمة المرور في متغيرات البيئة.",
      503,
    );
  }
  return configuration;
}

function mylerzError(response: MylerzResponse<unknown>, status: number) {
  const metadata =
    typeof response.ErrorMetadata === "string"
      ? ` (${response.ErrorMetadata})`
      : "";
  return `${response.ErrorDescription || `رفضت Mylerz الطلب برمز ${status}.`}${metadata}`;
}

async function getToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;
  const configuration = requiredConfiguration();
  let response: Response;
  try {
    response = await fetch(`${configuration.apiUrl}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "password",
        username: configuration.username,
        password: configuration.password,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MylerzIntegrationError(
      "تعذر الاتصال بـMylerz حاليًا. جرّب مرة أخرى بعد قليل.",
    );
  }
  let result: MylerzToken;
  try {
    result = (await response.json()) as MylerzToken;
  } catch {
    throw new MylerzIntegrationError("وصل رد غير صالح من Mylerz.");
  }
  if (!response.ok || !result.access_token) {
    throw new MylerzIntegrationError(
      "تعذر تسجيل الدخول إلى Mylerz. راجع بيانات الربط.",
      response.status === 401 ? 401 : 502,
    );
  }
  const seconds = Math.max(60, Number(result.expires_in) || 300);
  const value = `${result.token_type || "Bearer"} ${result.access_token}`;
  tokenCache = {
    value,
    expiresAt: Date.now() + Math.max(30, seconds - 60) * 1000,
  };
  return value;
}

async function mylerzJson<T>(path: string, options: RequestInit = {}) {
  const configuration = requiredConfiguration();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", await getToken());
  if (options.body) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${configuration.apiUrl}/api${path}`, {
      ...options,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new MylerzIntegrationError(
      "تعذر الاتصال بـMylerz حاليًا. جرّب مرة أخرى بعد قليل.",
    );
  }
  let result: MylerzResponse<T>;
  try {
    result = (await response.json()) as MylerzResponse<T>;
  } catch {
    throw new MylerzIntegrationError("وصل رد غير صالح من Mylerz.");
  }
  if (!response.ok || result.IsErrorState || result.Value === undefined) {
    throw new MylerzIntegrationError(
      mylerzError(result, response.status),
      response.status >= 400 && response.status < 500 ? 400 : 502,
    );
  }
  return result.Value;
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function matchName(names: string[], candidate?: string) {
  const normalized = normalize(candidate ?? "");
  return (
    normalized &&
    names.some((name) => {
      const source = normalize(name);
      return source === normalized;
    })
  );
}

async function getDestination(order: StoredOrder) {
  if (!zonesCache || zonesCache.expiresAt <= Date.now()) {
    zonesCache = {
      value: await mylerzJson<MylerzCity[]>("/Packages/GetCityZoneList"),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
  }
  const cities = zonesCache.value.filter(
    (item) =>
      matchName([order.governorate], item.ArName) ||
      matchName([order.governorate], item.EnName),
  );
  const city = cities.length === 1 ? cities[0] : undefined;
  const zone = city?.Zones?.find(
    (item) =>
      matchName([order.city], item.ArName) ||
      matchName([order.city], item.EnName),
  );
  if (!city?.Code) {
    throw new MylerzIntegrationError(
      `تعذر مطابقة «${order.governorate}» مع مدن Mylerz. راجع قائمة المناطق في حساب Mylerz.`,
      400,
    );
  }
  return {
    cityCode: city.Code,
    ...(zone?.Code ? { zoneCode: zone.Code } : {}),
  };
}

function egyptianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const key = digits.replace(/^(?:0020|20|0)/, "");
  return key.length === 10 ? `0${key}` : value.trim();
}

function statusTime(value?: string) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : new Date().toISOString();
}

export function orderStatusForMylerzStatus(
  status: string,
  current: OrderStatus,
): OrderStatus {
  if (["delivered", "cancelled", "returned"].includes(current)) return current;
  const kind = mylerzStatusKind(status);
  if (kind === "delivered") return "delivered";
  if (kind === "cancelled") return "cancelled";
  if (kind === "returned") return "returned";
  if (kind === "shipped") return "shipped";
  return current === "pending" ? "processing" : current;
}

export async function verifyMylerzConnection() {
  const warehouses = await mylerzJson<unknown[]>("/Orders/GetWarehouses");
  return { warehouses: Array.isArray(warehouses) ? warehouses.length : 0 };
}

export async function createMylerzShipment(
  order: StoredOrder,
): Promise<MylerzShipment> {
  if (order.mylerz?.trackingNumber)
    throw new MylerzIntegrationError("الطلب مربوط بشحنة Mylerz بالفعل.", 409);
  if (order.bosta?.trackingNumber)
    throw new MylerzIntegrationError(
      "الطلب مربوط ببوسطة بالفعل. استخدم شركة شحن واحدة لكل طلب.",
      409,
    );
  if (
    !Number.isFinite(Number(order.grand_total)) ||
    Number(order.grand_total) < 0
  ) {
    throw new MylerzIntegrationError(
      "لا يمكن إنشاء الشحنة قبل تأكيد أسعار الطلب والشحن.",
      400,
    );
  }
  if (["cancelled", "delivered", "returned"].includes(order.fulfillment_status))
    throw new MylerzIntegrationError("لا يمكن شحن طلب ملغي أو مكتمل.", 409);
  if (order.payment_method === "card" && order.payment_status !== "paid")
    throw new MylerzIntegrationError("يجب تأكيد الدفع الإلكتروني أولًا.", 400);
  const configuration = requiredConfiguration();
  const destination = await getDestination(order);
  const now = new Date();
  const pickupDueDate = new Date(
    now.getTime() + 24 * 60 * 60 * 1000,
  ).toISOString();
  const weight = configuration.defaultWeightKg;
  const description = order.order_items
    .map((item) => `${item.name_ar || item.name_en} × ${item.quantity}`)
    .join("، ")
    .slice(0, 200);
  const result = await mylerzJson<MylerzAddOrder>("/Orders/AddOrders", {
    method: "POST",
    body: JSON.stringify([
      {
        ...(configuration.warehouseName
          ? { WarehouseName: configuration.warehouseName }
          : {}),
        PickupDueDate: pickupDueDate,
        Package_Serial: 1,
        Reference: order.order_number,
        Description: description || "Xeemo order",
        Total_Weight: weight,
        Service_Type: "DTD",
        Service: "ND",
        Service_Category: "DELIVERY",
        Payment_Type: order.payment_method === "cod" ? "COD" : "PP",
        COD_Value:
          order.payment_method === "cod" ? Number(order.grand_total) : 0,
        Customer_Name: order.customer_name,
        Mobile_No: egyptianPhone(order.customer_phone),
        ...(order.alt_phone
          ? { Mobile_No2: egyptianPhone(order.alt_phone) }
          : {}),
        Street: order.address,
        Country: "Egypt",
        City: destination.cityCode,
        ...(destination.zoneCode ? { Neighborhood: destination.zoneCode } : {}),
        Address_Category: "H",
        Currency: "EGP",
        Special_Notes: [order.order_number, order.notes]
          .filter(Boolean)
          .join(" — ")
          .slice(0, 200),
        Pieces: [{ PieceNo: 1, Weight: weight }],
      },
    ]),
  });
  const packageResult = result.Packages?.[0];
  if (
    !packageResult?.BarCode ||
    packageResult.ErrorMessage ||
    result.ErrorMessage
  ) {
    throw new MylerzIntegrationError(
      packageResult?.ErrorMessage ||
        result.ErrorMessage ||
        "لم تُنشأ شحنة Mylerz.",
      400,
    );
  }
  return {
    trackingNumber: String(packageResult.BarCode),
    status: packageResult.Status?.trim() || "Uploaded",
    statusUpdatedAt: new Date().toISOString(),
    ...(result.PickupOrderCode
      ? { pickupOrderCode: String(result.PickupOrderCode) }
      : {}),
  };
}

export async function syncMylerzShipment(
  shipment: MylerzShipment,
): Promise<MylerzShipment> {
  const [statusResult, tracking] = await Promise.all([
    mylerzJson<{ Status?: string; BarCode?: string | number }>(
      `/Packages/GetPackageStatus?AWB=${encodeURIComponent(shipment.trackingNumber)}`,
    ),
    mylerzJson<MylerzTrack[]>("/Packages/TrackPackages", {
      method: "POST",
      body: JSON.stringify([
        { Barcode: shipment.trackingNumber, ReferenceNumber: "" },
      ]),
    }).catch(() => [] as MylerzTrack[]),
  ]);
  const logs = tracking[0]?.TrackLog ?? [];
  const latest = logs.at(-1);
  return {
    ...shipment,
    status:
      statusResult.Status?.trim() ||
      latest?.StatusArName?.trim() ||
      shipment.status,
    statusUpdatedAt: statusTime(latest?.ChangedDate),
    ...(logs.length
      ? {
          timeline: logs.map((log) => ({
            status:
              log.StatusArName?.trim() ||
              log.StatusEnName?.trim() ||
              "تحديث حالة",
            ...(log.ChangedDate
              ? { changedAt: statusTime(log.ChangedDate) }
              : {}),
          })),
        }
      : {}),
  };
}

export async function downloadMylerzAwb(trackingNumber: string) {
  const value = await mylerzJson<number[] | string>("/Packages/GetAWB", {
    method: "POST",
    body: JSON.stringify({ Barcode: trackingNumber, ReferenceNumber: "" }),
  });
  const bytes = Array.isArray(value)
    ? Uint8Array.from(value)
    : Uint8Array.from(
        Buffer.from(
          value.replace(/^data:application\/pdf;base64,/, ""),
          "base64",
        ),
      );
  if (
    bytes.length < 4 ||
    new TextDecoder().decode(bytes.slice(0, 4)) !== "%PDF"
  ) {
    throw new MylerzIntegrationError(
      "رد Mylerz لا يحتوي على بوليصة PDF صالحة.",
    );
  }
  return bytes;
}
