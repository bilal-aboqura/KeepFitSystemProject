# Data Model: B2B Cart, Checkout & Operational Admin Foundation

## Ownership map

```text
Customers: Customer ── effective Customer Type ───────────────┐
Catalog: Product ── Variant ── Sellable Unit ── conversion ──┤
Pricing: context + Variant + Sellable Unit ── Resolved Price ┤
Commerce: Quantity Rule ──────────────────────────────────────┤
Shipping / Discount policy ───────────────────────────────────┤
                                                               ▼
                     Checkout Quote ── Checkout Submission ── Order
                                                               │
                                                               ├── Order Line Snapshot
                                                               └── Order Domain Event
```

Feature 005 owns quantity rules, quote/confirmation state, submission idempotency, commerce snapshots, and orchestration. It references but does not copy Customer-Type, Catalog conversion, Pricing precedence, address, discount, or shipping configuration.

## Hard prerequisite contract

The physical names below for Sellable Unit and Pricing references are logical until Features 003 and 004 converge with their approved contracts. The Feature 005 migration preflight must bind them to verified implemented relations/functions and stop before writes if any are absent.

Required Catalog facts:

- stable Variant and Sellable Unit IDs with an enforceable Unit → Variant relationship;
- Unit active/archive and independent-sellability state;
- bilingual Unit label/code;
- authoritative base-equivalent/conversion result.

Required Pricing facts:

- batched and final-transaction-callable resolution for `(context, Variant, Sellable Unit, transaction time)`;
- integer EGP minor-unit amount, currency, source kind/reference, and derived state;
- no client-selected Customer, Customer Type, Price List, amount, or clock.

## Commerce Quantity Rule

Logical table: `commerce_quantity_rules`.

| Field | Rule |
|---|---|
| `id` | UUID primary key. |
| `context_kind` | Required `public` or `customer_type`. |
| `customer_type_id` | Null only for `public`; required restrictive FK for `customer_type`. |
| `variant_id`, `sellable_unit_id` | Required restrictive FKs; Unit must belong to Variant. |
| `minimum_quantity` | Positive integer. |
| `quantity_increment` | Positive integer. |
| `is_active`, `archived_at` | Only active, non-archived rows resolve. Archive preserves history. |
| `created_by`, `updated_by` | Nullable Auth user references for authorized operational actors. |
| `created_at`, `updated_at` | Database timestamps. |

Checks:

```text
(context_kind = public AND customer_type_id IS NULL)
OR
(context_kind = customer_type AND customer_type_id IS NOT NULL)

minimum_quantity > 0
quantity_increment > 0
```

Partial uniqueness:

```text
UNIQUE (variant_id, sellable_unit_id)
WHERE context_kind = 'public' AND is_active AND archived_at IS NULL

UNIQUE (customer_type_id, variant_id, sellable_unit_id)
WHERE context_kind = 'customer_type' AND is_active AND archived_at IS NULL
```

Resolution:

1. Guest: exact active public rule; otherwise 1/1.
2. Authenticated Customer: exact active rule for canonical effective Customer Type; otherwise 1/1.
3. Public never falls through to Retail; Customer-Type context never falls through to public.

Quantity validity:

```text
safe integer
AND quantity >= minimum_quantity
AND mod(quantity - minimum_quantity, quantity_increment) = 0
```

## Quantity Rule Audit Event

Logical table: `quantity_rule_audit_events`.

| Field | Rule |
|---|---|
| `id` | UUID primary key. |
| `rule_id` | Restrictive reference to the affected rule. |
| `action` | `created`, `updated`, `activated`, `deactivated`, or `archived`. |
| `actor_user_id` | Auth user who passed Admin authorization. |
| `context_kind`, `customer_type_id`, `variant_id`, `sellable_unit_id` | Target identity snapshot for search and history. |
| `previous_state`, `new_state` | Redacted JSON snapshots. |
| `correlation_id` | Request/operation correlation UUID. |
| `occurred_at` | Database timestamp. |

Events are append-only and service/Admin-only.

## Browser Cart Intent

Browser storage is versioned but not a database authority.

```text
CartDocument
  version: 2
  lines[]
    variantId: UUID
    sellableUnitId: UUID
    quantity: positive safe integer
    display?: disposable labels/image/price/rule snapshots
  recoveryLines[]?: malformed or ambiguous legacy entries
```

Canonical merge identity is `(variantId, sellableUnitId)`. The normalized sum must remain a safe positive integer. Offer/bundle compatibility may add a separately validated commercial-context discriminator; it can never make two different Units merge.

Legacy migration states:

- `canonical`: ready for server quote;
- `migrated`: old Product/Variant-only identity resolved unambiguously;
- `needs_selection`: more than one valid Variant or Unit;
- `unavailable`: no active purchasable target;
- `malformed`: invalid stored data.

Only canonical/migrated rows enter quote input. Other rows stay visible for correction/removal.

## Checkout Guest Context

The server issues 32 random bytes in a checkout-scoped HttpOnly cookie using `Secure` in production, `SameSite=Lax`, and bounded expiry. Only its SHA-256 hash is stored in quotes/submissions. It is independent of the order-confirmation grant so disclosure or rotation of one capability does not grant the other.

## Checkout Quote

Logical table: `checkout_quotes`.

| Field | Rule |
|---|---|
| `id` | Opaque UUID primary key. |
| `scope_kind` | `customer` or `guest`. |
| `customer_id` | Required only for Customer scope; restrictive FK. |
| `guest_context_hash` | 64 lowercase hex characters, required only for guest scope. Never store the cookie secret. |
| `revision` | Positive integer incremented whenever authoritative commercial content changes. |
| `state` | `draft`, `confirmed`, `consumed`, or `expired`. |
| `commercial_document` | Private canonical versioned JSON, including trusted source/snapshot metadata. |
| `safe_projection` | Customer-safe bilingual-neutral DTO material; contains no protected tier/source IDs. |
| `commercial_fingerprint` | SHA-256 of canonical commercial fields for current revision. |
| `confirmed_revision`, `confirmed_fingerprint`, `confirmed_at` | Set only by owned server confirmation; cleared on changed refresh. |
| `expires_at` | Thirty minutes after issue/refresh. Expiry requires a fresh quote and confirmation. |
| `consumed_order_id`, `consumed_at` | Set exactly once in final order transaction. |
| `created_at`, `updated_at` | Database timestamps. |

Scope check requires exactly one of `customer_id` and `guest_context_hash` according to `scope_kind`.

Suggested indexes:

- `(customer_id, state, expires_at DESC)` where Customer scope;
- `(guest_context_hash, state, expires_at DESC)` where guest scope;
- `(state, expires_at)` for cleanup;
- unique `consumed_order_id` where non-null.

### Canonical commercial document

```text
version, currency
context: public | { customerTypeId, customerTypeCode }
lines sorted by variantId + sellableUnitId:
  variantId, sellableUnitId, quantity
  unitAmountMinor, lineAmountMinor
  baseEquivalent snapshot
  quantityRule: context, minimum, increment, eligible
  priceSnapshot: source kind/reference, derived
adjustments sorted by kind/code:
  kind, code?, amountMinor, eligibility
shipping:
  normalized destination, policy/match, amountMinor
paymentMethod
subtotalMinor, discountMinor, shippingMinor, totalMinor
```

The fingerprint input includes all fields except protected source references not representing a Customer-visible commercial term. Non-commercial names, descriptions, images, and UI order are excluded. A separate safe diff maps changes to stable codes without exposing internals.

### Lifecycle

```text
draft ── explicit owned confirmation ──→ confirmed
  ▲                                        │
  └── authoritative change/revision ───────┤
                                           ├── identical finalization ──→ consumed
draft/confirmed ── timeout ────────────────→ expired
```

A consumed quote is immutable. A correctable change creates a new revision in `draft`; an ineligible result remains unconfirmed with actionable errors.

## Checkout Submission

Logical table: `checkout_submissions`.

| Field | Rule |
|---|---|
| `id` | UUID primary key. |
| `scope_kind` | `customer` or `guest`. |
| `scope_hash` | Server-derived SHA-256 scope; never accepted as browser authority. |
| `submission_key` | Client-generated UUID created once per Place Order attempt. |
| `quote_id`, `quote_revision` | Required confirmed quote identity. |
| `payload_hash` | Hash of scope, quote fingerprint/revision, delivery/payment intent, and final action version. |
| `state` | `accepted`, `completed`, or `failed_retryable`; validation/change failures are not accepted rows. |
| `first_accepted_at`, `expires_at` | Database time; expiry exactly 24 hours after acceptance. |
| `order_id` | Unique nullable Order reference, set on completion. |
| `last_error_code` | Safe operational code only; no raw exception/PII. |
| `created_at`, `updated_at` | Database timestamps. |

Constraints/indexes:

- unique `(scope_hash, submission_key)` while a record exists;
- unique `order_id` where non-null;
- `(scope_hash, submission_key, expires_at DESC)` for retry lookup;
- `(expires_at, state)` for cleanup.

The final RPC serializes scope/key with a transaction advisory lock before lookup/expiry replacement. Same unexpired payload returns the original result; changed payload conflicts; database failure rolls the record back with the order.

## Order additions

All additions are nullable for legacy rows. New Feature 005 orders use `commerce_snapshot_version = 1` and a completeness check enforced by the final command.

| Field | Rule |
|---|---|
| `commerce_snapshot_version` | Null for legacy; `1` for Feature 005 authoritative orders. |
| `checkout_quote_id`, `checkout_submission_id` | Unique references proving the consumed quote/submission. |
| `commercial_fingerprint` | Confirmed final commercial fingerprint. |
| `commerce_context_kind` | `public` or `customer_type`. |
| `customer_type_id_snapshot` | Nullable live reference for convenience; snapshot labels/codes remain authoritative historically. |
| `customer_type_code_snapshot`, `customer_type_name_en_snapshot`, `customer_type_name_ar_snapshot` | Immutable effective commercial context. Public context uses an explicit public code/labels. |
| `currency` | `EGP` for this feature. |
| `items_total_minor`, `discount_minor`, `shipping_cost_minor`, `grand_total_minor` | Authoritative integer snapshots. |
| `discount_snapshot`, `shipping_snapshot` | Immutable adjustment/policy JSON needed to explain totals. |

Existing name, phones, address, numeric totals, payment method/status, fulfillment status, and provider IDs remain. Compatibility numeric totals are written from minor values in the same transaction.

`fulfillment_status = pending` is the existing initial Order status and defines Milestone 1 Admin attention. Feature 005 adds no new lifecycle transitions.

## Order Line Snapshot additions

| Field | Rule |
|---|---|
| `sellable_unit_id` | Nullable restrictive/live reference for new lines; historical labels survive deletion/archive. |
| existing `variant_id`, `sku`, Product/Variant names | Retained and populated for new orders. |
| `sellable_unit_code_snapshot`, `sellable_unit_label_en_snapshot`, `sellable_unit_label_ar_snapshot` | Exact selected commercial unit. |
| `base_quantity_snapshot` | Exact authoritative equivalent expressed using the Catalog’s rational/decimal contract. |
| `unit_amount_minor`, `line_amount_minor`, `currency` | Immutable authoritative line money. |
| `price_source_kind`, `price_source_ref`, `price_was_derived` | Trusted operational snapshot; ordinary Customer DTO omits protected reference. |
| `quantity_rule_context_kind`, `quantity_rule_customer_type_id` | Rule context used. |
| `minimum_quantity_snapshot`, `quantity_increment_snapshot` | Why quantity was valid at purchase. |

New lines require positive integer quantity and `line_amount_minor = unit_amount_minor × quantity` within bounds. Existing `price` remains a compatibility projection from `unit_amount_minor`.

New snapshot-version lines are immutable through Admin item-edit APIs. Existing legacy-line editing is retained only behind an explicit legacy guard until Feature 008 defines controlled recalculation.

## Order Domain Event

Logical table: `order_domain_events`.

| Field | Rule |
|---|---|
| `id`, `correlation_id`, `order_id` | Stable UUIDs and restrictive Order reference. |
| `event_type`, `event_version` | `order.created`, version `1`. |
| `payload` | Non-secret snapshot references required by trusted adapters/future consumers. |
| `occurred_at` | Same transaction timestamp as Order creation. |

This is a durable fact, not Feature 009’s automation/subscription engine.

## Authorization and RLS

- Enable RLS on every new table.
- `commerce_quantity_rules`: no direct public/Customer table reads; safe resolved results only through Commerce handlers. Mutations require `requireAdminUser()` and a service-role-only RPC.
- Quote/submission tables: revoke anon/authenticated direct access; route handlers resolve session/guest cookie and return scoped DTOs through server-only services.
- Audit/domain events: revoke anon/authenticated access; trusted Admin/service access only.
- Orders/order lines retain existing own-Customer RLS and guest confirmation-grant access through server helpers; new protected pricing references are excluded from ordinary DTOs.
- Every new SECURITY DEFINER function uses an empty search path, schema-qualified objects, fixed grants, and service-role-only execution.

## Operational indexes

- `orders(fulfillment_status, created_at DESC)` for attention and status filter.
- `orders(payment_method, created_at DESC)` and `orders(customer_type_code_snapshot, created_at DESC)` for Milestone 1 filters.
- Existing order number index/uniqueness retained.
- Case-normalized order Customer name/phone search strategy selected during implementation using current PostgreSQL capability; no raw string interpolation.
- `order_items(lower(sku), order_id)` where SKU exists for operational SKU lookup.
- Quantity, quote, and submission indexes listed above support batch resolution, ownership, retry, and cleanup.

## Migration and compatibility invariants

1. Preflight required Feature 003/004 objects and catalog/pricing coverage; abort before writes on mismatch.
2. Add tables, functions, RLS/grants, indexes, and nullable Order/Line columns without rewriting history.
3. Existing orders remain `commerce_snapshot_version IS NULL` and render from current compatibility fields.
4. New finalization writes complete version-1 snapshots and compatibility fields atomically.
5. Do not invent historical Sellable Unit, packaging, Customer Type, quantity-rule, or pricing-source data.
6. New order-number branding affects new rows only; historical `XE-*` numbers and links remain valid.
7. Reapplying the migration is convergent; constraint and privilege checks are verified transactionally.
