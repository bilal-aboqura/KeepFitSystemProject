# Customer Type API Contract

All routes are same-origin App Router handlers. They return JSON, derive identity from the server session, validate request bodies, and never trust a client-supplied Customer identity. Error bodies are localized by the UI; they do not reveal raw database/security details.

## Customer routes

### `GET /api/customer/type-state`

**Authorization**: Authenticated Customer.

**Response 200**: effective type, active pending request when present, and customer-safe request history. Internal administrator notes and unrestricted audit fields are omitted.

**Errors**: `401` unauthenticated; `503` service unavailable.

### `POST /api/customer/type-requests`

**Authorization**: Authenticated canonical Customer.

**Body**:

```json
{
  "requested_type_code": "wholesale",
  "business_name": "Example Trading",
  "business_phone": "01012345678",
  "governorate": "Cairo",
  "city": "Nasr City",
  "business_description": "Optional",
  "customer_note": "Optional"
}
```

**Success 201**: new customer-safe pending request.

**Errors**: `401` unauthenticated; `422` invalid payload or type; `409` current pending request/eligibility conflict; `503` unavailable.

### `GET /api/customer/type-requests/history`

**Authorization**: Authenticated Customer. Returns only that Customer’s safe history projection.

## Admin routes

### `GET /api/admin/customer-type-requests?status=pending&requestedType=wholesale&effectiveType=retail`

**Authorization**: Existing `requireAdmin` boundary. Filters are optional; default status is `pending`.

**Response 200**: paginated or bounded queue records with Customer, current type, requested type, business name, phone, submitted time, and status.

### `GET /api/admin/customer-type-requests/{requestId}`

**Authorization**: Existing `requireAdmin` boundary.

**Response 200**: operational request detail, customer/contact information, decision fields, and relevant history.

### `POST /api/admin/customer-type-requests/{requestId}/approve`

**Authorization**: Existing `requireAdmin` boundary.

**Success 200**: finalized approved request and effective type.

**Errors**: `401/403` authorization failure; `404` unknown request; `409` not pending/stale; `422` invalid/inactive requested type; `503` unavailable.

### `POST /api/admin/customer-type-requests/{requestId}/reject`

**Authorization**: Existing `requireAdmin` boundary.

**Body**:

```json
{
  "public_reason": "Optional customer-facing explanation",
  "internal_note": "Optional operational note"
}
```

**Success 200**: finalized rejected request; effective type remains unchanged.

### `POST /api/admin/customers/{customerId}/customer-type`

**Authorization**: Existing `requireAdmin` boundary.

**Body**:

```json
{
  "target_type_code": "gym_owner",
  "reason": "Verified operational correction"
}
```

**Success 200**: new effective type plus any formerly pending request finalized as `superseded`.

**Errors**: `401/403` authorization failure; `404` Customer/type unknown; `409` concurrent state conflict; `422` inactive/invalid target; `503` unavailable.

## Non-negotiable contract rules

- Only stable type codes cross the UI/server contract; translated names never do.
- Request status and effective type are server-owned output fields, never accepted from customer bodies.
- All approval, rejection, and assignment commands are idempotency-safe through authoritative state checks; a stale repeat returns `409` and performs no overwrite.
- No contract exposes or modifies pricing, quantities, cart, checkout, payment, or order totals.
