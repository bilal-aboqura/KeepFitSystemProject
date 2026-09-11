import { z } from "zod";
import { customerTypeCodes, customerTypeRequestStatuses } from "./types";

export function normalizeEgyptianPhone(value: string) {
  const digits = value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/\D/g, "");
  const local = digits.replace(/^0020/, "0").replace(/^20(?=1)/, "0");
  return local;
}

export const egyptianPhoneSchema = z
  .string()
  .transform(normalizeEgyptianPhone)
  .refine((value) => /^01[0125]\d{8}$/.test(value), "Enter a valid Egyptian mobile number.");

export const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: egyptianPhoneSchema,
}).strict();

export const addressSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: egyptianPhoneSchema,
  governorate: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  address: z.string().trim().min(3).max(500),
  is_default: z.boolean().optional(),
}).strict();

export const customerTypeCodeSchema = z.enum(customerTypeCodes);
export const protectedCustomerTypeCodeSchema = z.enum(["wholesale", "gym_owner"]);
export const customerTypeRequestStatusSchema = z.enum(customerTypeRequestStatuses);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const optionalBusinessPhone = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  egyptianPhoneSchema.optional(),
);

export const customerTypeRequestSchema = z.object({
  requested_type_code: protectedCustomerTypeCodeSchema,
  business_name: z.string().trim().min(2).max(160),
  business_phone: optionalBusinessPhone,
  governorate: optionalText(100),
  city: optionalText(100),
  business_description: optionalText(1000),
  customer_note: optionalText(1000),
}).strict();

export const customerTypeDecisionSchema = z.object({
  public_reason: optionalText(1000),
  internal_note: optionalText(2000),
}).strict();

export const directCustomerTypeAssignmentSchema = z.object({
  target_type_code: customerTypeCodeSchema,
  reason: z.string().trim().min(2).max(1000),
}).strict();

export const adminCustomerTypeFiltersSchema = z.object({
  status: customerTypeRequestStatusSchema.optional(),
  requestedType: customerTypeCodeSchema.optional(),
  effectiveType: customerTypeCodeSchema.optional(),
}).strict();
