import crypto from "node:crypto";

const API_KEY = process.env.KASHIER_API_KEY;
const SECRET_KEY = process.env.KASHIER_SECRET_KEY;
const MERCHANT_ID = process.env.KASHIER_MERCHANT_ID;
// KASHIER_TESTMODE="true" → test mode; "false" → live mode
const TESTMODE = process.env.KASHIER_TESTMODE !== "false";
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";

export function isKashierConfigured() {
  return Boolean(API_KEY && MERCHANT_ID);
}

/**
 * Generate the order hash for Kashier hosted checkout (HMAC SHA256).
 * Path format: /?payment=merchantId.orderId.amount.currency
 */
export function generateOrderHash(
  merchantId: string,
  orderId: string,
  amount: string,
  currency: string,
): string {
  const path = `/?payment=${merchantId}.${orderId}.${amount}.${currency}`;
  return crypto.createHmac("sha256", API_KEY!).update(path).digest("hex");
}

export interface KashierPaymentParams {
  orderId: string;
  amount: number;
  currency?: string;
  metaData?: Record<string, unknown>;
  customerName?: string;
  customerEmail?: string;
  display?: "en" | "ar";
}

/**
 * Build the Kashier hosted-checkout redirect URL. The customer is sent here,
 * pays on Kashier's page, then is redirected back to /checkout/return while
 * Kashier POSTs the authoritative result to /api/kashier/webhook.
 */
export function createCheckoutUrl(params: KashierPaymentParams): string {
  if (!isKashierConfigured()) {
    throw new Error("Kashier is not configured (missing API key / merchant ID).");
  }
  const currency = params.currency ?? "EGP";
  const amountStr = params.amount.toFixed(2);

  const hash = generateOrderHash(MERCHANT_ID!, params.orderId, amountStr, currency);

  const queryParams = new URLSearchParams({
    merchantId: MERCHANT_ID!,
    orderId: params.orderId,
    amount: amountStr,
    currency,
    hash,
    mode: TESTMODE ? "test" : "live",
    merchantRedirect: `${SITE_URL}/checkout/return`,
    serverWebhook: `${SITE_URL}/api/kashier/webhook`,
    display: params.display ?? "ar",
    metaData: JSON.stringify(params.metaData ?? {}),
  });

  if (params.customerName) queryParams.set("name", params.customerName);
  if (params.customerEmail) queryParams.set("email", params.customerEmail);

  return `https://payments.kashier.io/?${queryParams.toString()}`;
}

export interface KashierWebhookBody {
  event?: string;
  hash?: string;
  data?: {
    signatureKeys?: string[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/**
 * Verify a Kashier webhook signature. Kashier tells us which fields to
 * concatenate (in order) via data.signatureKeys; we HMAC them and compare.
 * Tries the API key first, then the secret key as a fallback.
 */
export function verifyWebhookSignature(body: KashierWebhookBody): boolean {
  try {
    const hash = body.hash;
    const data = body.data;
    if (!hash || !data) return false;

    const signatureKeys = data.signatureKeys;
    if (!Array.isArray(signatureKeys) || signatureKeys.length === 0) return false;

    let signatureString = "";
    for (const key of signatureKeys) {
      const value = data[key];
      if (value !== undefined && value !== null) {
        signatureString += String(value);
      }
    }

    const withApiKey = crypto
      .createHmac("sha256", API_KEY!)
      .update(signatureString)
      .digest("hex");
    if (withApiKey === hash) return true;

    if (SECRET_KEY) {
      const withSecret = crypto
        .createHmac("sha256", SECRET_KEY)
        .update(signatureString)
        .digest("hex");
      if (withSecret === hash) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/** Human-readable summary of the webhook payment result (best-effort). */
export function extractWebhookResult(body: KashierWebhookBody) {
  const d = body.data ?? {};
  return {
    event: body.event,
    orderId: String(d.orderId ?? d.merchantOrderId ?? ""),
    kashierPaymentId: String(d.paymentId ?? d.id ?? ""),
    amount: Number(d.amount ?? 0),
    currency: String(d.currency ?? "EGP"),
    status: String(d.status ?? body.event ?? ""),
    raw: d,
  };
}
