import { describe, expect, it } from "vitest";
import { normalizeEgyptianPhone, profileSchema } from "@/lib/customers/validation";
import { isCustomerProfileComplete } from "@/lib/customers/identity";
describe("customer profile rules", () => {
  it.each(["+20 10 1234 5678", "00201012345678", "۰۱۰۱۲۳۴۵۶۷۸"])("normalizes %s", input => expect(normalizeEgyptianPhone(input)).toBe("01012345678"));
  it.each(["0123", "", "02012345678"])("rejects invalid phone %s", phone => expect(isCustomerProfileComplete({full_name:"Name",phone})).toBe(false));
  it("rejects whitespace names", () => expect(isCustomerProfileComplete({full_name:" ",phone:"01012345678"})).toBe(false));
  it("allows the same contact phone on separate profiles",()=>{const a=profileSchema.parse({full_name:"First Customer",phone:"01012345678"});const b=profileSchema.parse({full_name:"Second Customer",phone:a.phone});expect(b.phone).toBe(a.phone);});
  it("normalizes Arabic Egyptian mobile digits", () => expect(normalizeEgyptianPhone("٠١٠ ١٢٣٤ ٥٦٧٨")).toBe("01012345678"));
  it("accepts a complete profile", () => expect(isCustomerProfileComplete(profileSchema.parse({ full_name: "A Customer", phone: "01012345678" }))).toBe(true));
  it("rejects privileged profile fields", () => expect(() => profileSchema.parse({ full_name: "A Customer", phone: "01012345678", is_admin: true })).toThrow());
});
