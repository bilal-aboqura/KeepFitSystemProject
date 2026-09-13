import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { newConfirmationGrant } from "@/lib/customers/grants";
import { createCheckoutUrl } from "@/lib/kashier";
import { minorToCompatibilityNumber, parseMinorAmount } from "@/lib/pricing/money";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveCommerceContext } from "./context";
import { CommerceError } from "./errors";
import { revalidateConfirmedQuote } from "./quote";
import type { CommercePaymentMethod } from "./types";
import type { OrderSubmissionInput } from "./validation";

interface CommittedPaymentOrder {
  orderId: string;
  orderNumber: string;
  grandTotalMinor: string;
  paymentMethod: CommercePaymentMethod;
  customerName: string;
}

export async function prepareCommittedPayment(
  order: CommittedPaymentOrder,
  dependencies: { createCheckoutUrl: typeof createCheckoutUrl } = { createCheckoutUrl },
) {
  if (order.paymentMethod === "cod") return `/checkout/success?order=${encodeURIComponent(order.orderNumber)}`;
  return dependencies.createCheckoutUrl({
    orderId: order.orderNumber,
    amount: minorToCompatibilityNumber(parseMinorAmount(order.grandTotalMinor, { allowZero: true })),
    currency: "EGP",
    metaData: { orderId: order.orderId, orderNumber: order.orderNumber },
    customerName: order.customerName,
  });
}

function mapFinalizationError(message?: string) {
  if (message?.includes("QUOTE_NOT_FOUND")) return new CommerceError("QUOTE_NOT_FOUND");
  if (message?.includes("QUOTE_EXPIRED")) return new CommerceError("QUOTE_EXPIRED");
  if (message?.includes("QUOTE_REVISION_CONFLICT")) return new CommerceError("QUOTE_REVISION_CONFLICT");
  if (message?.includes("IDEMPOTENCY_CONFLICT")) return new CommerceError("IDEMPOTENCY_CONFLICT");
  if (message?.includes("RECONFIRMATION_REQUIRED")) return new CommerceError("RECONFIRMATION_REQUIRED");
  if (message?.includes("QUOTE_INVALID")) return new CommerceError("QUOTE_INVALID");
  return new CommerceError("CHECKOUT_UNAVAILABLE");
}

export async function finalizeConfirmedQuote(input: OrderSubmissionInput) {
  const context = await resolveCommerceContext();
  if (context.scopeKind === "guest" && !context.guestContextHash) throw new CommerceError("QUOTE_NOT_FOUND");
  const db = getSupabaseServiceClient();
  if (!db) throw new CommerceError("CHECKOUT_UNAVAILABLE");
  await revalidateConfirmedQuote(input.quoteId, input.quoteRevision, context);
  const confirmationGrant = context.scopeKind === "guest" ? newConfirmationGrant() : undefined;
  const payloadHash = createHash("sha256").update(JSON.stringify({
    scopeKind: context.scopeKind,
    customerId: context.customerId,
    guestContextHash: context.guestContextHash,
    quoteId: input.quoteId,
    quoteRevision: input.quoteRevision,
    submissionId: input.submissionId,
    version: 1,
  })).digest("hex");
  const correlationId = randomUUID();
  const { data, error } = await db.rpc("commerce_finalize_order", {
    p_scope_kind: context.scopeKind,
    p_customer_id: context.customerId,
    p_guest_context_hash: context.guestContextHash,
    p_quote_id: input.quoteId,
    p_quote_revision: input.quoteRevision,
    p_submission_key: input.submissionId,
    p_payload_hash: payloadHash,
    p_correlation_id: correlationId,
    p_confirmation_grant_hash: confirmationGrant?.hash ?? null,
  });
  if (error || !data) throw mapFinalizationError(error?.message);
  const order = data as CommittedPaymentOrder & { kind: "created" | "replayed" };
  const redirect = await prepareCommittedPayment(order);
  return {
    result: order.kind === "replayed" ? "created" as const : order.kind,
    replayed: order.kind === "replayed",
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    redirect,
    confirmationGrant: order.kind === "created" ? confirmationGrant : undefined,
  };
}
