import { describe, expect, it } from "vitest";
import {
  customerTypeCodeSchema,
  customerTypeRequestSchema,
  customerTypeDecisionSchema,
  directCustomerTypeAssignmentSchema,
} from "@/lib/customers/validation";
import {
  getBusinessNameLabel,
  isProtectedCustomerType,
} from "@/lib/customers/customer-types";
import { validGymRequest, validWholesaleRequest } from "../../helpers/customer-type-fixtures";

describe("customer type validation", () => {
  it("accepts stable commercial codes and excludes Retail requests", () => {
    expect(customerTypeCodeSchema.parse("wholesale")).toBe("wholesale");
    expect(customerTypeCodeSchema.parse("gym_owner")).toBe("gym_owner");
    expect(() => customerTypeRequestSchema.parse({ ...validWholesaleRequest, requested_type_code: "retail" })).toThrow();
    expect(() => customerTypeCodeSchema.parse("Wholesale Trader")).toThrow();
  });

  it("normalizes shared Egyptian business phones without making them identifiers", () => {
    const first = customerTypeRequestSchema.parse(validWholesaleRequest);
    const second = customerTypeRequestSchema.parse({ ...validWholesaleRequest, business_name: "Another Business" });
    expect(first.business_phone).toBe("01012345678");
    expect(second.business_phone).toBe(first.business_phone);
  });

  it("uses type-specific business labels while rules remain code-based", () => {
    expect(getBusinessNameLabel("wholesale", "en")).toBe("Trading / business name");
    expect(getBusinessNameLabel("gym_owner", "en")).toBe("Gym name");
    expect(getBusinessNameLabel("gym_owner", "ar")).toContain("الجيم");
    expect(isProtectedCustomerType("retail")).toBe(false);
    expect(isProtectedCustomerType("wholesale")).toBe(true);
  });

  it("bounds optional fields and rejects server-owned fields", () => {
    expect(customerTypeRequestSchema.parse(validGymRequest).requested_type_code).toBe("gym_owner");
    expect(() => customerTypeRequestSchema.parse({ ...validGymRequest, status: "approved" })).toThrow();
    expect(() => customerTypeRequestSchema.parse({ ...validGymRequest, customer_id: crypto.randomUUID() })).toThrow();
    expect(() => customerTypeRequestSchema.parse({ ...validGymRequest, customer_note: "x".repeat(1001) })).toThrow();
  });

  it("keeps public and internal decision notes separate", () => {
    expect(customerTypeDecisionSchema.parse({ public_reason: "Missing proof", internal_note: "Retry after verification" })).toEqual({
      public_reason: "Missing proof",
      internal_note: "Retry after verification",
    });
    expect(() => customerTypeDecisionSchema.parse({ public_reason: "No", decided_by: crypto.randomUUID() })).toThrow();
  });

  it("allows only stable target codes in direct assignments", () => {
    expect(directCustomerTypeAssignmentSchema.parse({ target_type_code: "retail", reason: "Operational correction" })).toEqual({
      target_type_code: "retail",
      reason: "Operational correction",
    });
    expect(() => directCustomerTypeAssignmentSchema.parse({ target_type_code: "Retail", reason: "x" })).toThrow();
  });
});
