import { describe, expect, it } from "vitest";
import { normalizeEgyptianPhone, profileSchema } from "@/lib/customers/validation";
import { isCustomerProfileComplete } from "@/lib/customers/identity";
describe("customer profile rules", () => {
  it("normalizes Arabic Egyptian mobile digits", () => expect(normalizeEgyptianPhone("٠١٠ ١٢٣٤ ٥٦٧٨")).toBe("01012345678"));
  it("accepts a complete profile", () => expect(isCustomerProfileComplete(profileSchema.parse({ full_name: "A Customer", phone: "01012345678" }))).toBe(true));
  it("rejects privileged profile fields", () => expect(() => profileSchema.parse({ full_name: "A Customer", phone: "01012345678", is_admin: true })).toThrow());
});
