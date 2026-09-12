import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  adminCustomerTypeFiltersSchema,
  customerTypeRequestSchema,
} from "./validation";
import { listCustomerTypes, mapCustomerTypeDatabaseError } from "./customer-types";
import type {
  AdminCustomerTypeFilters,
  AdminCustomerTypeRequest,
  AdminCustomerTypeRequestDetail,
  Customer,
  CustomerType,
  CustomerTypeAuditEvent,
  CustomerTypeCommandResult,
  CustomerTypeRequestAdmin,
  CustomerTypeRequestPublic,
  CustomerTypeState,
} from "./types";

type RequestRow = Omit<CustomerTypeRequestAdmin, "requested_type">;

const publicRequestColumns = [
  "id",
  "customer_id",
  "requested_type_id",
  "status",
  "business_name",
  "business_phone",
  "governorate",
  "city",
  "business_description",
  "customer_note",
  "rejection_reason_public",
  "submitted_at",
  "decided_at",
  "superseded_at",
].join(", ");

const adminRequestColumns = `${publicRequestColumns}, internal_admin_note, decided_by, superseded_by`;

function typeMap(types: CustomerType[]) {
  return new Map(types.map((type) => [type.id, type]));
}

function toPublicRequest(row: RequestRow, types: Map<string, CustomerType>): CustomerTypeRequestPublic | null {
  const requestedType = types.get(row.requested_type_id);
  if (!requestedType) return null;
  return {
    id: row.id,
    customer_id: row.customer_id,
    requested_type: requestedType,
    status: row.status,
    business_name: row.business_name,
    business_phone: row.business_phone,
    governorate: row.governorate,
    city: row.city,
    business_description: row.business_description,
    customer_note: row.customer_note,
    rejection_reason_public: row.rejection_reason_public,
    submitted_at: row.submitted_at,
    decided_at: row.decided_at,
    superseded_at: row.superseded_at,
  };
}

function toAdminRequest(row: RequestRow, types: Map<string, CustomerType>): CustomerTypeRequestAdmin | null {
  const publicRequest = toPublicRequest(row, types);
  if (!publicRequest) return null;
  return {
    ...publicRequest,
    requested_type_id: row.requested_type_id,
    internal_admin_note: row.internal_admin_note,
    decided_by: row.decided_by,
    superseded_by: row.superseded_by,
  };
}

export async function listCustomerTypeHistory(customerId: string): Promise<CustomerTypeRequestPublic[]> {
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  const [types, result] = await Promise.all([
    listCustomerTypes(),
    sb
      .from("customer_type_requests")
      .select(publicRequestColumns)
      .eq("customer_id", customerId)
      .order("submitted_at", { ascending: false }),
  ]);
  if (result.error) return [];
  const typesById = typeMap(types);
  return ((result.data ?? []) as unknown as RequestRow[])
    .map((row) => toPublicRequest(row, typesById))
    .filter((request): request is CustomerTypeRequestPublic => Boolean(request));
}

export async function getCustomerTypeState(customerId: string): Promise<CustomerTypeState | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const [{ data: customer, error }, types, history] = await Promise.all([
    sb.from("customers").select("customer_type_id").eq("id", customerId).maybeSingle(),
    listCustomerTypes(),
    listCustomerTypeHistory(customerId),
  ]);
  if (error || !customer?.customer_type_id) return null;
  const effectiveType = types.find((type) => type.id === customer.customer_type_id);
  if (!effectiveType) return null;
  const pendingRequest = history.find((request) => request.status === "pending") ?? null;
  const availableTypes = types.filter(
    (type) => type.is_active && type.requires_approval && type.id !== effectiveType.id,
  );
  return {
    effective_type: effectiveType,
    available_types: availableTypes,
    pending_request: pendingRequest,
    history: history.filter((request) => request.status !== "pending"),
    can_request: !pendingRequest && availableTypes.length > 0,
  };
}

export async function createCustomerTypeRequest(
  customerId: string,
  input: unknown,
): Promise<CustomerTypeCommandResult<CustomerTypeRequestPublic>> {
  const parsed = customerTypeRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const sb = getSupabaseServiceClient();
  if (!sb) return { ok: false, error: "unavailable" };
  const value = parsed.data;
  const { data, error } = await sb.rpc("create_customer_type_request", {
    p_customer_id: customerId,
    p_requested_type_code: value.requested_type_code,
    p_business_name: value.business_name,
    p_business_phone: value.business_phone ?? null,
    p_governorate: value.governorate ?? null,
    p_city: value.city ?? null,
    p_business_description: value.business_description ?? null,
    p_customer_note: value.customer_note ?? null,
  });
  if (error) return { ok: false, error: mapCustomerTypeDatabaseError(error) };
  const requestId = (data as { request_id?: string } | null)?.request_id;
  const state = await getCustomerTypeState(customerId);
  const pendingRequest = state?.pending_request;
  const request = pendingRequest?.id === requestId ? pendingRequest : null;
  return request ? { ok: true, data: request } : { ok: false, error: "unavailable" };
}

export async function listAdminCustomerTypeRequests(
  input: AdminCustomerTypeFilters = {},
): Promise<AdminCustomerTypeRequest[]> {
  const parsed = adminCustomerTypeFiltersSchema.safeParse(input);
  if (!parsed.success) return [];
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  const types = await listCustomerTypes();
  const typesById = typeMap(types);
  const filters = parsed.data;
  let query = sb
    .from("customer_type_requests")
    .select(adminRequestColumns)
    .eq("status", filters.status ?? "pending")
    .order("submitted_at", { ascending: true })
    .limit(200);
  if (filters.requestedType) {
    const requestedType = types.find((type) => type.code === filters.requestedType);
    if (!requestedType) return [];
    query = query.eq("requested_type_id", requestedType.id);
  }
  if (filters.effectiveType) {
    const effectiveType = types.find((type) => type.code === filters.effectiveType);
    if (!effectiveType) return [];
    const { data: matchingCustomers } = await sb
      .from("customers")
      .select("id")
      .eq("customer_type_id", effectiveType.id);
    const ids = (matchingCustomers ?? []).map((customer) => customer.id);
    if (ids.length === 0) return [];
    query = query.in("customer_id", ids);
  }
  const { data, error } = await query;
  if (error || !data?.length) return [];
  const rows = data as unknown as RequestRow[];
  const customerIds = Array.from(new Set(rows.map((row) => row.customer_id)));
  const { data: customers } = await sb
    .from("customers")
    .select("id, auth_user_id, full_name, email, phone, customer_type_id")
    .in("id", customerIds);
  const customersById = new Map(
    ((customers ?? []) as Customer[]).map((customer) => [customer.id, customer]),
  );
  return rows.flatMap((row) => {
    const request = toAdminRequest(row, typesById);
    const customer = customersById.get(row.customer_id);
    const effectiveType = customer ? typesById.get(customer.customer_type_id) : null;
    return request && customer && effectiveType
      ? [{ ...request, customer, effective_type: effectiveType }]
      : [];
  });
}

export async function getAdminCustomerTypeRequest(
  requestId: string,
): Promise<AdminCustomerTypeRequestDetail | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data: selected } = await sb
    .from("customer_type_requests")
    .select(adminRequestColumns)
    .eq("id", requestId)
    .maybeSingle();
  if (!selected) return null;
  const row = selected as unknown as RequestRow;
  const [types, customerResult, historyResult, auditResult] = await Promise.all([
    listCustomerTypes(),
    sb
      .from("customers")
      .select("id, auth_user_id, full_name, email, phone, customer_type_id")
      .eq("id", row.customer_id)
      .maybeSingle(),
    sb
      .from("customer_type_requests")
      .select(adminRequestColumns)
      .eq("customer_id", row.customer_id)
      .order("submitted_at", { ascending: false }),
    sb
      .from("customer_type_audit_events")
      .select("id, customer_id, request_id, action, previous_type_id, new_type_id, actor_user_id, reason_public, internal_note, occurred_at")
      .eq("customer_id", row.customer_id)
      .order("occurred_at", { ascending: false }),
  ]);
  const customer = customerResult.data as Customer | null;
  const typesById = typeMap(types);
  const request = toAdminRequest(row, typesById);
  const effectiveType = customer ? typesById.get(customer.customer_type_id) : null;
  if (!customer || !request || !effectiveType) return null;
  const history = ((historyResult.data ?? []) as unknown as RequestRow[])
    .map((item) => toAdminRequest(item, typesById))
    .filter((item): item is CustomerTypeRequestAdmin => Boolean(item));
  return {
    ...request,
    customer,
    effective_type: effectiveType,
    history,
    audit_events: (auditResult.data ?? []) as CustomerTypeAuditEvent[],
  };
}

export async function getPendingCustomerTypeRequestCount() {
  const sb = getSupabaseServiceClient();
  if (!sb) return 0;
  const { count } = await sb
    .from("customer_type_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
