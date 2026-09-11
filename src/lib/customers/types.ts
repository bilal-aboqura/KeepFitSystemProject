export interface Customer {
  id: string;
  auth_user_id: string | null;
  customer_type_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  full_name: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
  is_default: boolean;
}

export const customerProfileFields = ["full_name", "phone"] as const;

export const customerTypeCodes = ["retail", "wholesale", "gym_owner"] as const;
export type CustomerTypeCode = (typeof customerTypeCodes)[number];

export const customerTypeRequestStatuses = ["pending", "approved", "rejected", "superseded"] as const;
export type CustomerTypeRequestStatus = (typeof customerTypeRequestStatuses)[number];

export const customerTypeAuditActions = ["requested", "approved", "rejected", "superseded", "assigned"] as const;
export type CustomerTypeAuditAction = (typeof customerTypeAuditActions)[number];

export interface CustomerType {
  id: string;
  code: CustomerTypeCode;
  name_ar: string;
  name_en: string;
  requires_approval: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface CustomerTypeRequestPublic {
  id: string;
  customer_id: string;
  requested_type: CustomerType;
  status: CustomerTypeRequestStatus;
  business_name: string;
  business_phone: string | null;
  governorate: string | null;
  city: string | null;
  business_description: string | null;
  customer_note: string | null;
  rejection_reason_public: string | null;
  submitted_at: string;
  decided_at: string | null;
  superseded_at: string | null;
}

export interface CustomerTypeRequestAdmin extends CustomerTypeRequestPublic {
  requested_type_id: string;
  internal_admin_note: string | null;
  decided_by: string | null;
  superseded_by: string | null;
}

export interface CustomerTypeAuditEvent {
  id: string;
  customer_id: string;
  request_id: string | null;
  action: CustomerTypeAuditAction;
  previous_type_id: string | null;
  new_type_id: string | null;
  actor_user_id: string | null;
  reason_public: string | null;
  internal_note: string | null;
  occurred_at: string;
}

export interface CustomerTypeState {
  effective_type: CustomerType;
  available_types: CustomerType[];
  pending_request: CustomerTypeRequestPublic | null;
  history: CustomerTypeRequestPublic[];
  can_request: boolean;
}

export interface AdminCustomerTypeRequest extends CustomerTypeRequestAdmin {
  customer: Pick<Customer, "id" | "full_name" | "email" | "phone" | "auth_user_id">;
  effective_type: CustomerType;
}

export interface AdminCustomerTypeRequestDetail extends AdminCustomerTypeRequest {
  history: CustomerTypeRequestAdmin[];
  audit_events: CustomerTypeAuditEvent[];
}

export interface AdminCustomerTypeFilters {
  status?: CustomerTypeRequestStatus;
  requestedType?: CustomerTypeCode;
  effectiveType?: CustomerTypeCode;
}

export type CustomerTypeCommandError =
  | "unauthorized"
  | "not_found"
  | "validation"
  | "conflict"
  | "unavailable";

export type CustomerTypeCommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: CustomerTypeCommandError };

export interface CustomerTypeAssignmentResult {
  customer_id: string;
  status: "assigned";
  effective_type_id: string;
  previous_type_id: string;
  superseded_request_id: string | null;
}
