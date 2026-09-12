import { z } from "zod";
import { MAX_AMOUNT_MINOR } from "./money";

const uuidSchema = z.string().uuid();
const instantSchema = z.string().datetime({ offset: true });
const optionalInstantSchema = instantSchema.nullable().optional();
const amountMinorSchema = z.string().regex(/^[0-9]+$/).refine((value) => {
  const amount = BigInt(value);
  return amount > BigInt(0) && amount <= MAX_AMOUNT_MINOR;
}, "Price must be a positive bounded piastre amount");

export const pricingIntervalSchema = z.object({
  valid_from: optionalInstantSchema,
  valid_until: optionalInstantSchema,
}).strict().superRefine((value, context) => {
  if (value.valid_from && value.valid_until && Date.parse(value.valid_until) <= Date.parse(value.valid_from)) {
    context.addIssue({ code: "custom", path: ["valid_until"], message: "valid_until must be later than valid_from" });
  }
});

export const priceListInputSchema = z.object({
  code: z.string().trim().min(2).max(64).regex(/^[a-z][a-z0-9-]*$/),
  name_en: z.string().trim().min(1).max(160),
  name_ar: z.string().trim().min(1).max(160),
  currency: z.literal("EGP").default("EGP"),
  is_active: z.boolean().default(true),
}).strict();

export const priceListUpdateSchema = priceListInputSchema.partial().strict();

export const priceListItemInputSchema = z.object({
  variant_id: uuidSchema,
  sellable_unit_id: uuidSchema,
  amount_minor: amountMinorSchema,
  valid_from: optionalInstantSchema,
  valid_until: optionalInstantSchema,
  close_prior_at_start: z.boolean().optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.valid_from && value.valid_until && Date.parse(value.valid_until) <= Date.parse(value.valid_from)) {
    context.addIssue({ code: "custom", path: ["valid_until"], message: "valid_until must be later than valid_from" });
  }
});

export const priceListBulkItemsSchema = z.object({
  items: z.array(priceListItemInputSchema).min(1).max(1000),
  correlation_id: uuidSchema.optional(),
}).strict();

export const customerTypeMappingSchema = z.object({
  customer_type_id: uuidSchema,
  price_list_id: uuidSchema.nullable(),
  reason: z.string().trim().max(1000).nullable().optional(),
}).strict();

export const directCustomerPriceListSchema = z.object({
  price_list_id: uuidSchema,
  reason: z.string().trim().max(1000).nullable().optional(),
}).strict();

export const customerPriceOverrideSchema = z.object({
  customer_id: uuidSchema.optional(),
  variant_id: uuidSchema,
  sellable_unit_id: uuidSchema,
  amount_minor: amountMinorSchema,
  currency: z.literal("EGP").default("EGP"),
  valid_from: optionalInstantSchema,
  valid_until: optionalInstantSchema,
  reason: z.string().trim().min(1).max(1000),
  close_prior_at_start: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (value.valid_from && value.valid_until && Date.parse(value.valid_until) <= Date.parse(value.valid_from)) {
    context.addIssue({ code: "custom", path: ["valid_until"], message: "valid_until must be later than valid_from" });
  }
});

export const repriceItemSchema = z.object({
  variant_id: uuidSchema,
  sellable_unit_id: uuidSchema,
  quantity: z.number().int().positive().max(10000),
}).strict();

export const repriceInputSchema = z.object({
  items: z.array(repriceItemSchema).min(1).max(200),
}).strict();

export const pricingDiagnosticInputSchema = z.object({
  customer_id: uuidSchema.nullable().optional(),
  variant_id: uuidSchema,
  sellable_unit_id: uuidSchema,
  at: instantSchema.optional(),
}).strict();

export const defaultPriceListSchema = z.object({
  price_list_id: uuidSchema,
  expected_version: z.number().int().nonnegative().optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
}).strict();

export const priceListIdParamsSchema = z.object({ id: uuidSchema }).strict();
export const customerIdParamsSchema = z.object({ customerId: uuidSchema }).strict();
