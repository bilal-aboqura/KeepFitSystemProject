import "server-only";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { mapCustomerTypeDatabaseError } from "./customer-types";
import { getAdminCustomerTypeRequest } from "./type-requests";
import {
  customerTypeDecisionSchema,
  directCustomerTypeAssignmentSchema,
} from "./validation";
import type {
  AdminCustomerTypeRequestDetail,
  CustomerTypeAssignmentResult,
  CustomerTypeCommandResult,
} from "./types";

const uuidSchema = z.string().uuid();

export async function approveCustomerTypeRequest(
  requestId: string,
  adminUserId: string,
): Promise<CustomerTypeCommandResult<AdminCustomerTypeRequestDetail>> {
  if (!uuidSchema.safeParse(requestId).success || !uuidSchema.safeParse(adminUserId).success) {
    return { ok: false, error: "validation" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { ok: false, error: "unavailable" };
  const { error } = await sb.rpc("approve_customer_type_request", {
    p_request_id: requestId,
    p_admin_user_id: adminUserId,
  });
  if (error) return { ok: false, error: mapCustomerTypeDatabaseError(error) };
  const request = await getAdminCustomerTypeRequest(requestId);
  return request ? { ok: true, data: request } : { ok: false, error: "unavailable" };
}

export async function rejectCustomerTypeRequest(
  requestId: string,
  adminUserId: string,
  input: unknown,
): Promise<CustomerTypeCommandResult<AdminCustomerTypeRequestDetail>> {
  const parsed = customerTypeDecisionSchema.safeParse(input);
  if (!uuidSchema.safeParse(requestId).success || !uuidSchema.safeParse(adminUserId).success || !parsed.success) {
    return { ok: false, error: "validation" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { ok: false, error: "unavailable" };
  const { error } = await sb.rpc("reject_customer_type_request", {
    p_request_id: requestId,
    p_admin_user_id: adminUserId,
    p_public_reason: parsed.data.public_reason ?? null,
    p_internal_note: parsed.data.internal_note ?? null,
  });
  if (error) return { ok: false, error: mapCustomerTypeDatabaseError(error) };
  const request = await getAdminCustomerTypeRequest(requestId);
  return request ? { ok: true, data: request } : { ok: false, error: "unavailable" };
}

export async function assignCustomerType(
  customerId: string,
  adminUserId: string,
  input: unknown,
): Promise<CustomerTypeCommandResult<CustomerTypeAssignmentResult>> {
  const parsed = directCustomerTypeAssignmentSchema.safeParse(input);
  if (!uuidSchema.safeParse(customerId).success || !uuidSchema.safeParse(adminUserId).success || !parsed.success) {
    return { ok: false, error: "validation" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { ok: false, error: "unavailable" };
  const { data, error } = await sb.rpc("assign_customer_type", {
    p_customer_id: customerId,
    p_target_type_code: parsed.data.target_type_code,
    p_admin_user_id: adminUserId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: mapCustomerTypeDatabaseError(error) };
  return { ok: true, data: data as CustomerTypeAssignmentResult };
}
