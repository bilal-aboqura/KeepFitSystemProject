import { z } from "zod";

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
