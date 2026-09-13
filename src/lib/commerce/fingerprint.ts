import { createHash } from "node:crypto";
import type { CommerceChange } from "./types";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function integerString(value: unknown) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  if (typeof value === "string" && /^-?(0|[1-9]\d*)$/.test(value)) return value;
  return String(value ?? "");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as JsonRecord).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalize(nested)]));
}

function commercialLines(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const line = record(entry);
    const rule = record(line.quantityRule);
    return {
      variantId: String(line.variantId ?? ""),
      sellableUnitId: String(line.sellableUnitId ?? ""),
      quantity: integerString(line.quantity),
      baseQuantityNumerator: integerString(line.baseQuantityNumerator),
      baseQuantityDenominator: integerString(line.baseQuantityDenominator),
      unitAmountMinor: integerString(line.unitAmountMinor),
      lineAmountMinor: integerString(line.lineAmountMinor),
      quantityRule: {
        contextKind: String(rule.contextKind ?? ""),
        customerTypeId: rule.customerTypeId ?? null,
        minimum: integerString(rule.minimum),
        increment: integerString(rule.increment),
        eligible: rule.eligible === true,
      },
    };
  }).sort((left, right) => `${left.variantId}:${left.sellableUnitId}`.localeCompare(`${right.variantId}:${right.sellableUnitId}`));
}

function commercialAdjustments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const adjustment = record(entry);
    return { kind: String(adjustment.kind ?? ""), code: adjustment.code ?? null, amountMinor: integerString(adjustment.amountMinor), eligible: adjustment.eligible !== false };
  }).sort((left, right) => `${left.kind}:${left.code ?? ""}`.localeCompare(`${right.kind}:${right.code ?? ""}`));
}

export function canonicalCommercialDocument(value: unknown) {
  const document = record(value);
  const context = record(document.context);
  const shipping = record(document.shipping);
  const delivery = record(document.delivery);
  return canonicalize({
    version: integerString(document.version ?? 1),
    currency: String(document.currency ?? "EGP"),
    context: {
      contextKind: String(context.contextKind ?? ""),
      customerTypeId: context.customerTypeId ?? null,
      customerTypeCode: context.customerTypeCode ?? null,
    },
    lines: commercialLines(document.lines),
    adjustments: commercialAdjustments(document.adjustments),
    shipping: {
      policy: String(shipping.policy ?? ""),
      governorate: shipping.governorate ?? null,
      city: shipping.city ?? null,
      amountMinor: integerString(shipping.amountMinor ?? document.shippingMinor),
    },
    delivery: {
      governorate: delivery.governorate ?? null,
      city: delivery.city ?? null,
      address: delivery.address ?? null,
    },
    paymentMethod: String(document.paymentMethod ?? ""),
    discountCode: document.discountCode ?? null,
    subtotalMinor: integerString(document.subtotalMinor),
    discountMinor: integerString(document.discountMinor),
    shippingMinor: integerString(document.shippingMinor),
    totalMinor: integerString(document.totalMinor),
  });
}

export function canonicalCommercialJson(value: unknown) {
  return JSON.stringify(canonicalCommercialDocument(value));
}

export function commercialFingerprint(value: unknown) {
  return createHash("sha256").update(canonicalCommercialJson(value)).digest("hex");
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

export function diffCommercialDocuments(previous: unknown, current: unknown): CommerceChange[] {
  const before = record(previous);
  const after = record(current);
  const beforeLines = commercialLines(before.lines);
  const afterLines = commercialLines(after.lines);
  const previousByKey = new Map(beforeLines.map((line) => [`${line.variantId}:${line.sellableUnitId}`, line]));
  const currentByKey = new Map(afterLines.map((line) => [`${line.variantId}:${line.sellableUnitId}`, line]));
  const changes: CommerceChange[] = [];
  if (!same([...previousByKey.keys()], [...currentByKey.keys()])) changes.push({ kind: "line_identity_changed" });
  for (const [key, oldLine] of previousByKey) {
    const newLine = currentByKey.get(key);
    if (!newLine) continue;
    const line = { variantId: oldLine.variantId, sellableUnitId: oldLine.sellableUnitId };
    if (oldLine.quantity !== newLine.quantity) changes.push({ kind: "line_identity_changed", line });
    if (oldLine.quantityRule.eligible !== newLine.quantityRule.eligible) changes.push({ kind: "eligibility_changed", line });
    if (!same({ ...oldLine.quantityRule, eligible: undefined }, { ...newLine.quantityRule, eligible: undefined })) changes.push({ kind: "quantity_rule_changed", line });
    if (oldLine.unitAmountMinor !== newLine.unitAmountMinor || oldLine.lineAmountMinor !== newLine.lineAmountMinor) changes.push({ kind: "unit_price_changed", line });
  }
  if (!same(commercialAdjustments(before.adjustments), commercialAdjustments(after.adjustments))) changes.push({ kind: "adjustment_changed" });
  if (!same(record(before.shipping), record(after.shipping)) || integerString(before.shippingMinor) !== integerString(after.shippingMinor)) changes.push({ kind: "shipping_changed" });
  if (before.paymentMethod !== after.paymentMethod) changes.push({ kind: "payment_changed" });
  if (integerString(before.totalMinor) !== integerString(after.totalMinor)) changes.push({ kind: "total_changed" });
  const beforeContext = record(before.context);
  const afterContext = record(after.context);
  if (beforeContext.contextKind !== afterContext.contextKind || beforeContext.customerTypeId !== afterContext.customerTypeId) changes.push({ kind: "eligibility_changed" });
  return changes.filter((change, index) => changes.findIndex((candidate) => candidate.kind === change.kind && same(candidate.line, change.line)) === index);
}
