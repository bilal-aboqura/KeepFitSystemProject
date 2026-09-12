# Feature Specification: Pricing Engine

**Feature Branch**: `004-pricing-engine`  
**Created**: 2026-09-12  
**Status**: Draft  
**Input**: User description: "Build authoritative variant pricing engine"

## Clarifications

### Session 2026-09-12

- Q: How are scheduled price replacements handled for one Variant in one Price List? → A: Price periods never overlap; end time is exclusive.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receive the correct authoritative Variant price (Priority: P1)

A guest or authenticated customer sees the price appropriate to their current pricing context on Product listings, Product detail, and cart. The effective Customer Type from Feature 002 and the selected Variant from Feature 003 determine the context; displayed browser prices are never authoritative.

**Why this priority**: Deterministic Variant pricing is the prerequisite for accurate storefront commerce and safe checkout.

**Independent Test**: Configure default, Retail, Wholesale, and Gym Price Lists for one Variant; verify guest/default, Retail, approved Wholesale, and approved Gym customers each receive the intended effective price, while a pending Wholesale request remains Retail-priced.

**Acceptance Scenarios**:

1. **Given** a guest and a configured active default Price List, **When** the guest views an active Variant, **Then** they see only the active default-list price.
2. **Given** an authenticated Customer with an approved effective type mapped to an active Price List, **When** they view/select a Variant, **Then** they receive that type’s effective price without a Client-supplied Customer Type input.
3. **Given** a Retail Customer with a pending Wholesale request, **When** price is resolved, **Then** Retail pricing remains effective and Wholesale prices are not exposed.
4. **Given** a Variant price changes after the customer viewed it, **When** the cart is authoritatively repriced, **Then** the current price is returned rather than silently retaining a stale client amount.

---

### User Story 2 - Complete checkout with server-authoritative totals (Priority: P1)

A customer submits selected Variant IDs and quantities to checkout. Immediately before order creation, the server independently resolves each purchasable Variant price, recalculates line/subtotal values, applies only existing supported adjustments, and stores immutable price/source snapshots.

**Why this priority**: This closes the existing critical vulnerability in which client-submitted line prices could control order totals.

**Independent Test**: Submit an order request with a valid Variant/quantity but a manipulated low client price; verify the persisted line and order totals use the Pricing Engine result, and a later price change does not alter that completed order.

**Acceptance Scenarios**:

1. **Given** a checkout request containing an altered `price` or total, **When** the server creates the order, **Then** those client amounts are ignored and totals are recalculated from authoritative Variant prices.
2. **Given** a valid Customer/guest and multiple purchasable Variants, **When** an order is created, **Then** all unit prices, line totals, and subtotal are calculated from one authoritative pricing context and stored as snapshots.
3. **Given** a Variant has no valid applicable price after permitted fallbacks, **When** checkout attempts to order it, **Then** no order is created and the customer receives a clear retry-safe pricing error.
4. **Given** an order completed at one price, **When** pricing configuration later changes, **Then** the existing order’s stored price and total remain unchanged.

---

### User Story 3 - Manage Price Lists and customer price rules (Priority: P2)

An authorized administrator can create/activate/deactivate Price Lists, maintain Variant-level prices in an operational workflow, choose one usable default Price List, map Customer Types to Price Lists, and optionally assign a direct Price List or Variant-specific override to a Customer.

**Why this priority**: Pricing must be business-configurable without code edits or hardcoded Retail/Wholesale/Gym branches.

**Independent Test**: Create an active Wholesale List, set a Variant price, map Wholesale Trader to it, set a Customer’s direct list and then a Variant override; verify resolution follows the documented precedence and inactive/expired records are ignored.

**Acceptance Scenarios**:

1. **Given** an authorized administrator, **When** they create or update an active Price List and its Variant entries, **Then** future resolution uses it according to the configured mapping and validity rules.
2. **Given** one system default Price List, **When** an administrator attempts to create a second default or deactivate the only usable default, **Then** the action is refused or replaced atomically so one usable default remains.
3. **Given** a Customer-specific Variant override, direct Customer Price List, type Price List, and default Price List, **When** a price is resolved, **Then** the first active, in-period applicable level wins in that precedence order.
4. **Given** a pricing record is inactive or outside its validity period, **When** it would otherwise be selected, **Then** it is skipped without affecting historical orders.

---

### User Story 4 - Diagnose and protect pricing operations (Priority: P2)

An authorized administrator can search pricing data, preview why a Variant price resolves for a Customer, and audit meaningful configuration/override changes. Ordinary customers see only their own resolved sell price and cannot discover protected tiers or mutate pricing.

**Why this priority**: Pricing decisions need operational explainability without leaking B2B or special-customer information.

**Independent Test**: Preview a Variant for a Wholesale Customer with an override and verify source diagnostics; attempt to request another Customer Type/List or mutate a Price List as a customer and verify denial/no price-tier leakage.

**Acceptance Scenarios**:

1. **Given** an authorized administrator, **When** they preview a Customer/Variant price, **Then** the result shows the resolved amount and relevant resolution source without changing configuration.
2. **Given** an ordinary customer, **When** they request pricing with another Customer ID, Customer Type, or Price List ID, **Then** the request cannot alter their pricing context or reveal protected price data.
3. **Given** an administrator changes a meaningful Price List, mapping, default, or Customer override, **When** the change is saved, **Then** sufficient audit history retains affected entity, prior/new values where applicable, actor, and time.
4. **Given** an archived Variant with historical price records, **When** pricing is queried for new purchase, **Then** it remains unavailable even if a valid historical price exists.

### Edge Cases

- Exactly one usable default Price List remains effective; an inactive or invalid default cannot be selected.
- Price records with missing, negative, or invalid amount are never selected; zero price is not treated as a missing-price fallback and is permitted only under an explicit future business policy.
- Price periods for one Variant in one Price List never overlap; each period ends exclusively so a replacement may start exactly at the previous period's end. Browser time never determines validity.
- A missing Customer-specific/direct/type price falls through only to the next approved source; no arbitrary Product/client price is used.
- No resolved valid price makes a Variant unavailable for new sale without changing its catalog/archive state.
- Customer Type changes affect subsequent resolutions only; pending/rejected requests and historic type records never grant price access.
- A price cache, if used later, cannot return one Customer’s protected price to another Customer.
- Existing discounts/coupons remain separate from resolved Variant unit price; this feature does not redesign discount behavior.
- New orders snapshot amount/source; existing orders are never repriced or migrated from their existing totals.
- Arabic RTL and English LTR price/status/error/admin flows work at approximately 390 px without horizontal overflow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Pricing Engine MUST be the sole authoritative source of sell price for new storefront, cart, checkout, order, admin-order, and future-tool flows.
- **FR-002**: The Pricing Engine MUST resolve prices using canonical `variant_id`; Product parent records MUST NOT be the primary pricing unit.
- **FR-003**: The system MUST maintain extensible persistent Price Lists with stable identity/code, bilingual display names, active state, currency, optional validity, and audit timestamps.
- **FR-004**: Price List entries MUST identify one Variant, one monetary price, active state, and optional server-time validity. Price periods for the same Variant/List MUST never overlap and MUST use an exclusive end boundary.
- **FR-005**: The system MUST support configurable Customer Type-to-Price List mapping using only the authoritative effective Customer Type from Feature 002.
- **FR-006**: The system MUST maintain exactly one active usable default/public Price List. Guests and otherwise unmatched pricing contexts MUST use this configured default.
- **FR-007**: The system MUST support an explicit Customer-specific Variant price override and a direct Customer Price List assignment for authorized operational use.
- **FR-008**: Price resolution MUST apply this deterministic order among active, in-period candidates: Customer Variant override; direct Customer Price List; effective Customer Type Price List; configured default Price List; unavailable-price outcome.
- **FR-009**: Pending/rejected Customer Type requests, phone numbers, names, raw email comparisons, order heuristics, and client-supplied Customer/Type/List values MUST NOT choose a protected price.
- **FR-010**: Price resolution MUST return the Variant, amount, currency, and safe source information useful for server/audit/admin diagnostics without exposing protected alternative tiers to ordinary customers.
- **FR-011**: Initial sell currency is EGP. Monetary values and calculation must follow one consistent safe precision policy without unsafe floating-point discrepancy across customer and server views.
- **FR-012**: Inactive/expired Price Lists, entries, mappings, direct assignments, and overrides MUST NOT be selected. Validity MUST use authoritative server time.
- **FR-013**: Missing/invalid price data MUST never resolve as zero or a client-provided amount. After valid fallbacks are exhausted, the Variant MUST be unavailable for new purchase.
- **FR-014**: Storefront listing/detail and cart price displays MUST be derived from the Pricing Engine for the current session context. Multi-Variant Products MUST not imply that one Variant price applies to all Variants when it differs.
- **FR-015**: New cart price values MAY be cached as display snapshots but MUST be server-repriceable from Variant IDs and quantities.
- **FR-016**: Before persisting a new order, the server MUST resolve authenticated Customer context where present, validate purchasable Variants, recalculate authoritative unit/line/subtotal values, apply only existing supported non-pricing adjustments, and reject unresolved pricing.
- **FR-017**: Order creation MUST ignore client-submitted unit prices, line totals, items subtotal, and grand total when determining sell price.
- **FR-018**: New order lines MUST retain immutable Variant unit-price/line-total snapshots and, where useful, the pricing source snapshot. Later pricing changes MUST NOT alter completed orders.
- **FR-019**: Existing orders/totals remain historical records and MUST NOT be repriced by Feature 004.
- **FR-020**: Existing basic Variant compatibility prices MUST migrate safely into initial default Price List entries without loss of current base storefront prices.
- **FR-021**: Price List administration MUST let authorized users create/edit/activate/deactivate Lists and Variant entries, search/filter by Product/Variant/SKU/Brand/List/status, and maintain prices operationally without fixed schema columns per list.
- **FR-022**: Authorized users MUST be able to map Customer Types to Price Lists, assign/remove a direct Customer Price List, configure/change the default List, and create/change/archive Customer Variant overrides.
- **FR-023**: Pricing configuration updates that could leave zero/two defaults or partial bulk pricing state MUST be transaction-safe and preserve a usable resolution path.
- **FR-024**: Price Lists and pricing records with historic relevance MUST use archive/deactivation rather than destructive deletion where possible.
- **FR-025**: Authorized admin flows MUST provide read-only pricing preview/diagnostics explaining the selected source for a Customer/Variant.
- **FR-026**: Ordinary customers MUST see only the resolved price applicable to their own session and MUST NOT receive protected List/override/diagnostic data.
- **FR-027**: Only authorized admin/operational users MUST mutate Price Lists, entries, mappings, defaults, direct assignments, and overrides. Authorization MUST be enforced below the UI and new pricing tables MUST not expose broad Customer access.
- **FR-028**: Pricing mutations and meaningful override/default/mapping changes MUST be audit-compatible with actor, target, old/new state where applicable, reason/context, and time.
- **FR-029**: Archived/inactive Catalog Variants MUST remain unavailable for new purchase even when historical price records exist.
- **FR-030**: The system MUST preserve existing coupon/discount behavior as a distinct post-unit-price adjustment; it MUST NOT maintain competing final sell-price authorities.
- **FR-031**: Customer Type, minimum quantity, tier pricing, eligibility, inventory, deposits, payment proof, order lifecycle, warehouse, purchasing, finance, AI, and automation behaviors are out of scope except as already-existing compatibility flows.
- **FR-032**: Google auth, Customer identity/types/approval, Variant Catalog/R2 media, guest/authenticated checkout, order history, admin authorization, COD, Kashier, Bosta, Mylerz, notifications, and analytics MUST remain functional.

### Key Entities *(include if feature involves data)*

- **Price List**: Reusable pricing set with stable business identity, visibility/lifecycle, currency, optional validity, and one configured default when designated.
- **Price List Item**: One Variant’s explicit price within a Price List, with lifecycle/validity and audit metadata.
- **Customer Type Price List Mapping**: Configurable association between an effective Customer Type and a Price List.
- **Customer Direct Price List Assignment**: Optional Customer-specific List selection, higher-priority than type mapping but lower-priority than a Variant override.
- **Customer Variant Price Override**: Explicit Customer-and-Variant special price with lifecycle/validity and audit history.
- **Resolved Price**: Server-authoritative result containing Variant, amount/currency, safe selected source, and source identifiers for trusted operational use.
- **Order Price Snapshot**: Immutable unit/line amount and source context captured on a completed new order line.

### Operational Controls *(include when applicable)*

- **Authorization**: Server-derived session Customer context controls customer price reads. Existing admin authority protects every pricing configuration mutation and diagnostic.
- **Auditability**: Defaults, mappings, Lists, entries, direct assignments, and Customer overrides preserve meaningful history and decision actor/time.
- **Commercial authority**: Variant pricing is server-resolved and type-neutral only through configured data. Client prices never control orders; discounts remain a separate adjustment.
- **Transaction integrity**: Default uniqueness, price validity/precedence, order recalculation/snapshotting, and meaningful bulk configuration changes use authoritative consistent operations.
- **Events & integrations**: Pricing changes are structured for later audit/automation use; payment/shipping/analytics consume immutable order snapshots rather than live pricing.
- **Existing functionality impact**: Existing Customer/Variant and checkout/integration paths remain available; Feature 005 consumes pricing results rather than reimplementing price logic.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance tests, 100% of purchasable active Variants resolve exactly one deterministic authoritative price or an explicit unavailable outcome for guest, Retail, Wholesale, Gym, direct-list, and override contexts.
- **SC-002**: In acceptance tests, 100% of pending/rejected type, client Customer Type/List, Customer ID, and unit-price spoofing attempts fail to obtain protected prices or change authoritative order totals.
- **SC-003**: 100% of new order lines in pricing acceptance tests store server-calculated immutable unit/line price snapshots; subsequent price changes alter no completed historical order.
- **SC-004**: A customer can select a Variant, see its effective price, and receive a server-repriced cart result in under 2 minutes at a 390 px viewport.
- **SC-005**: An authorized administrator can create/match a Price List Variant price and preview the result for a Customer in under 3 minutes in usability testing.
- **SC-006**: 100% of tested missing/inactive/expired price paths fall through only to permitted configured sources or block new purchase; none become zero or client-price orders.
- **SC-007**: Feature 001–003 regression journeys and named payment/shipping/notification/analytics flows complete successfully; equivalent Customers still receive no pricing distinction unless configured through this feature’s approved rules.

## Assumptions

- Feature 003 supplies stable purchasable Variant identities and a compatibility base price for safe migration to initial default List items.
- Direct Customer Price List assignment is included as an authorized operational capability and follows the stated precedence.
- One EGP precision policy is applied consistently; multi-currency conversion is outside this feature.
- Zero-price variants are unavailable unless a future explicit business rule permits zero prices.
- Scheduled validity is supported for pricing records using server time, not a promotional campaign system.
- Existing coupons/discounts and shipping calculations retain their current intended behavior after authoritative Variant unit pricing is resolved.
- Price caching, import/export, advanced bulk workflows, and Feature 005 checkout UX refinements may be planned only where they do not weaken pricing authority or expand scope.
