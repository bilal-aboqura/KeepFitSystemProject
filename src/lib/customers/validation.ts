import { z } from "zod";

export function normalizeEgyptianPhone(value: string) {
  const digits = normalizeContactDigits(value);
  return digits.replace(/^0020/, "0").replace(/^20(?=1)/, "0");
}

export function normalizeContactDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/\D/g, "");
}

export const checkoutPhoneSchema = z.string().transform(normalizeContactDigits)
  .pipe(z.string().regex(/^\d{6,20}$/, "Phone number must contain 6 to 20 digits."));

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
