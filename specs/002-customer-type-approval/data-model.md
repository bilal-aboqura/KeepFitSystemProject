# Data Model: Customer Types & Approval

## Relationship model

```text
auth.users (optional) → customers ──→ customer_types
                             │
                             ├──→ customer_type_requests ──→ customer_types (requested)
                             └──→ customer_type_audit_events
profiles.is_admin ────────────┘ (acting-admin authorization projection)
```

## Customer Types

| Field | Rule / purpose |
|---|---|
| `id` | Stable immutable primary identifier. |
| `code` | Unique stable machine identifier: `retail`, `wholesale`, or `gym_owner`; never derived from translated names. |
| `name_ar`, `name_en` | Display labels for RTL/LTR presentation. |
| `requires_approval` | Customer-originated protected-access rule. Retail is false; initial commercial types are true. |
| `is_active` | Enables future request selection; it does not invalidate current assignments/history. |
| `sort_order` | Presentation ordering only. |
| timestamps | Operational traceability. |

Initial seed records must include one active Retail baseline. Customer-type configuration has no customer-facing mutation path.

## Customers (extension)

| Field | Rule / purpose |
|---|---|
| `customer_type_id` | Required effective-type reference after safe Retail backfill. The sole classification authority for future features. |

Existing `id`, `auth_user_id`, identity/contact values, address relations, and order relations remain unchanged. No historical commercial classification is inferred from orders, names, phones, or email.

## Customer Type Requests

| Field | Rule / purpose |
|---|---|
| `id` | Stable immutable request identifier. |
| `customer_id` | Required canonical Customer owner. |
| `requested_type_id` | Required Customer Type requested by the customer. |
| `status` | `pending`, `approved`, `rejected`, or `superseded`; final statuses cannot transition again. |
| `business_name` | Required trimmed business/trading name; labeled Gym Name for gym requests. |
| `business_phone` | Optional normalized Egyptian business phone; never globally unique. |
| `governorate`, `city` | Optional business location fields. |
| `business_description`, `customer_note` | Optional bounded customer details. |
| `rejection_reason_public` | Optional customer-visible rejection explanation. |
| `internal_admin_note` | Optional private operational note; never included in customer projections. |
| `submitted_at`, `decided_at`, `decided_by` | Lifecycle metadata; decision actor references the existing Auth/admin identity. |
| `superseded_at`, `superseded_by` | Direct-assignment closure trace where applicable. |
| timestamps | Creation/update traceability. |

Invariants: requested type exists, is active at submission, requires approval, and differs from the current effective type. A partial unique index permits at most one `pending` request per Customer. Request history is never deleted or overwritten by reapplication.

## Customer Type Audit Events

| Field | Rule / purpose |
|---|---|
| `id` | Stable event identifier. |
| `customer_id` | Customer affected by the action. |
| `request_id` | Optional related request. |
| `action` | `requested`, `approved`, `rejected`, `superseded`, or `assigned`. |
| `previous_type_id`, `new_type_id` | Type transition trace, where applicable. |
| `actor_user_id` | Null for customer submission if not required, otherwise current authenticated actor; required for admin decision/assignment. |
| `reason_public`, `internal_note` | Decision context with projection controls. |
| `occurred_at` | Immutable operational timestamp. |

Audit records support event readiness (`CUSTOMER_TYPE_REQUESTED`, `CUSTOMER_TYPE_APPROVED`, `CUSTOMER_TYPE_REJECTED`, `CUSTOMER_TYPE_SUPERSEDED`, `CUSTOMER_TYPE_ASSIGNED`) without adding an automation queue.

## Transition matrix

| Command | Preconditions | Result | Effective type |
|---|---|---|---|
| Request protected type | Authenticated canonical Customer; active protected type; no pending request | New `pending` request + audit | Unchanged |
| Approve | Authorized admin; request is `pending`; requested type valid | `approved` + decision/audit | Changes to requested type |
| Reject | Authorized admin; request is `pending` | `rejected` + decision/audit | Unchanged |
| Direct assignment | Authorized admin; target type active | Optional pending request becomes `superseded`; assignment/audit | Changes to target type |

`approved`, `rejected`, and `superseded` are final. Direct assignment is the approved clarification: it always closes a current pending request as `superseded` in the same transaction.

## Access matrix

| Resource/action | Guest | Authenticated customer | Authorized admin/server |
|---|---|---|---|
| Active type display data | Read only as needed for request UI | Read only | Read/manage configuration through future authorized process |
| Own effective type and request history | None | Own projection only | Read |
| Create protected request | None | Current session's canonical Customer only | May assist through future authorized process |
| Approve/reject/assign | Denied | Denied | Allowed through guarded command |
| Internal notes/audit | Denied | Denied | Allowed through authorized operational projection |
