# Data Model: Authoritative Pricing Engine

## Ownership model

```text
Customer Type ── Type-to-List mapping ────┐
Customer ────── Direct List assignment ───┼── Price List ── Price List Item
Customer ────── Unit price override ──────┘                    │
                                                               ▼
Product ── Variant ── Sellable Unit ── conversion graph ── Resolved Price
                                                               │
Orders ── immutable price snapshot ────────────────────────────┘
```

Feature 003 owns Product/Variant/Sellable Unit, their sellability, and conversion graph. Feature 002 owns effective Customer Type. Pricing owns configuration and resolution only; it copies neither type requests nor packaging facts.

## Price List

| Field | Rule |
|---|---|
| `id` | UUID primary key. |
| `code` | Stable unique lowercase business ID; never translated/reused casually. |
| `name_ar`, `name_en` | Required localized operational labels. |
| `currency` | EGP initially; constrained for intentional future expansion. |
| `is_active`, `archived_at` | Inactive/archived Lists are ineligible for new pricing but retain history. |
| `created_at`, `updated_at` | Server timestamps. |

Default state is not duplicated on List rows. One-row `pricing_configuration` references `default_price_list_id`, records actor/time/version, and is locked by default-change commands so exactly one active usable List remains.

## Price List Item

| Field | Rule |
|---|---|
| `id`, `price_list_id` | UUID and restrictive FK. |
| `variant_id`, `sellable_unit_id` | Required Feature 003 target; command validates ownership. |
| `amount_minor` | Non-negative bounded EGP piastres; zero rejected until an explicit policy permits it. |
| `valid_from`, `valid_until` | Optional `timestamptz`; `[)` effective range with infinite null bound; explicit end must exceed start. |
| `is_active`, `archived_at` | Only active/non-archived effective rows resolve. |
| actor/timestamps | Audit metadata. |

GiST exclusion on List + Variant + Unit + range prevents overlap. Supporting indexes serve resolver and grid queries.

## Customer Type Price List Mapping

`customer_type_price_list_mappings` has unique `customer_type_id`, `price_list_id`, active/archive state, actor/timestamps. It has at most one current mapping. Resolver ignores inactive mapping/type/List and falls through.

## Direct Customer Price List Assignment

Add nullable `customers.direct_price_list_id` for exactly one current direct List and retain append-only `customer_price_list_assignment_audit` records for set/remove. It is independent of `customer_type_id`; admin commands require an active target List. Null returns to type/default pricing.

## Customer Unit Price Override

`customer_unit_price_overrides` contains UUID/id, `customer_id`, Variant/Unit target, `amount_minor`, `currency`, validity interval, `is_active`, archive state, actor/reason/timestamps. An exclusion constraint on Customer + Variant + Unit + range prevents simultaneous effective overrides. Explicit unit override is highest priority and may also act as derivation ancestor.

## Resolved Price

```text
ResolvedPrice
  target: variantId, sellableUnitId
  amountMinor, currency
  availability: priced | unavailable
  source: customer_override | direct_price_list | customer_type_price_list | default_price_list
  explicitOrDerived: explicit | derived
  sourceIds: priceListId?, priceListItemId?, overrideId?
  derivedFrom: sellableUnitId?, conversionPath?
  effectiveAt
```

Trusted server/admin callers can see source IDs/path. Public output contains only own amount, currency, availability, and display-safe state.

## Audit and order snapshots

`pricing_audit_events` has action, actor, target IDs, Customer/Variant/Unit where relevant, correlation ID, redacted before/after JSON, reason/context, and time. It is server/admin-only.

Feature 003's new order line is extended additively with `variant_id`, `sellable_unit_id`, SKU/Variant/Unit label snapshots, `base_unit_equivalent`, unit/line minor values (or safe aligned compatibility fields), currency, source/reference, and derived flag. New orders require complete snapshots; legacy rows stay valid and are never repriced.

## Lifecycle invariants

| Entity | Rule |
|---|---|
| Default configuration | Exactly one active usable List. |
| Item / Override | No overlapping effective target intervals; archive preserves history. |
| Mapping / assignment | Valid active reference or absent, with absence falling through. |
| Variant / Unit | Must be active and sellable for new purchase. |
| Order snapshot | Immutable after create commit. |
