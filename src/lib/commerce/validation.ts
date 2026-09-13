import { z } from "zod";
import { checkoutPhoneSchema } from "@/lib/customers/validation";

const boundedText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);

export const commerceLineIntentSchema = z.object({
  variantId: z.string().uuid(),
  sellableUnitId: z.string().uuid(),
  quantity: z.number().int().positive().safe(),
}).strict();

export const cartQuoteInputSchema = z.object({
  lines: z.array(commerceLineIntentSchema).min(1).max(100),
  discountCode: boundedText(1, 80).optional(),
}).strict();

export const deliveryAddressSchema = z.object({
  fullName: boundedText(2, 120),
  phone: checkoutPhoneSchema,
  altPhone: z.union([checkoutPhoneSchema, z.literal("")]),
  governorate: boundedText(1, 120),
  city: boundedText(1, 120),
  address: boundedText(3, 500),
}).strict().refine((value) => !value.altPhone || value.altPhone !== value.phone, {
  error: "The alternative phone number must differ from the main phone number.",
  path: ["altPhone"],
});

const savedDeliverySchema = z.object({ savedAddressId: z.string().uuid() }).strict();
const addressDeliverySchema = z.object({ address: deliveryAddressSchema }).strict();

export const checkoutQuoteInputSchema = z.object({
  lines: z.array(commerceLineIntentSchema).min(1).max(100),
  delivery: z.union([savedDeliverySchema, addressDeliverySchema]),
  contact: z.null().optional(),
  paymentMethod: z.enum(["cod", "card"]),
  discountCode: boundedText(1, 80).nullable().optional(),
  notes: boundedText(1, 1000).nullable().optional(),
}).strict();

export const quoteConfirmationInputSchema = z.object({
  revision: z.number().int().positive().safe(),
}).strict();

export const orderSubmissionInputSchema = z.object({
  quoteId: z.string().uuid(),
  quoteRevision: z.number().int().positive().safe(),
  submissionId: z.string().uuid(),
}).strict();

export const quantityRuleContextSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("public") }).strict(),
  z.object({ kind: z.literal("customer_type"), customerTypeId: z.string().uuid() }).strict(),
]);

export const quantityRuleMutationSchema = z.object({
  context: quantityRuleContextSchema,
  variantId: z.string().uuid(),
  sellableUnitId: z.string().uuid(),
  minimumQuantity: z.number().int().positive().safe(),
  quantityIncrement: z.number().int().positive().safe(),
  reason: boundedText(1, 1000),
}).strict();

export const quantityRuleArchiveSchema = z.object({ reason: boundedText(1, 1000) }).strict();

export type CartQuoteInput = z.infer<typeof cartQuoteInputSchema>;
export type CheckoutQuoteInput = z.infer<typeof checkoutQuoteInputSchema>;
export type OrderSubmissionInput = z.infer<typeof orderSubmissionInputSchema>;
