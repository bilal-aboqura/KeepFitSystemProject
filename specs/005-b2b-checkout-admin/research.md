# Research: B2B Cart, Checkout & Operational Admin Foundation

## Repository audit and prerequisite gate

### Decision

Treat the checked-out repository, not milestone labels, as implementation truth. Feature 005 design is complete, but implementation and commerce cutover are blocked until two prerequisites converge:

1. Feature 003 must supply a distinct Sellable Unit model, Variant ownership, independent sellability, and packaging conversion/base-equivalent data.
2. Feature 004 must supply the authoritative `(Variant, Sellable Unit)` pricing resolver, public/type/direct/override contexts, fixed-point EGP amounts, and immutable price-source snapshots.

The Feature 005 migration runner must preflight both contracts and abort before writes when required relations, columns, constraints, or callable resolver seams are absent.

### Rationale

The repository currently contains `product_variants` but no Sellable Unit or packaging-conversion relation. Feature 004 has approved design artifacts but no migration, runner, `src/lib/pricing/` domain, pricing routes, or tests. Pretending these are implemented would make Feature 005 duplicate missing domain behavior and violate the modular-monolith and single-source-of-truth principles.

### Alternatives considered

- Treat Variant as the Sellable Unit: rejected because the approved Feature 005 contract requires Box/Ampoule/Strip lines for the same Variant to remain distinct.
- Implement a second temporary price/unit model inside Commerce: rejected because it would create competing Catalog and Pricing authorities.
- Stop planning entirely: rejected because the target design can be completed now with an explicit implementation gate and dependency order.

## Current implementation: reuse versus replacement

### Decision

Reuse the existing App Router application, Customer session/profile/address services, Customer-Type approval RPCs, Product/Variant catalog, guest confirmation-grant pattern, Egyptian shipping lookup, coupons, COD/Kashier adapters, order history, Admin shell, shipment panels, and Vitest transactional test harness. Replace or narrow these unsafe compatibility paths during cutover:

- `src/lib/cart.ts`: migrate from Variant-only/local price identity to canonical Variant + Sellable Unit intent; retain defensive legacy parsing.
- `src/lib/data/orders.ts` and `POST /api/orders`: replace browser/compatibility-price orchestration with quote confirmation and a final authoritative transaction.
- `customer_create_order`: supersede with a versioned commerce finalization RPC that accepts identities and server-owned quote/submission references, never caller-supplied monetary authority.
- Client-only cart/checkout totals: render quote DTOs instead of calculating commercial truth locally.
- Admin Orders client filtering over the newest 100 rows: replace with indexed server pagination/search/filter.
- Broad item editing for new orders: disable for Feature 005 snapshot-version orders; retain only explicitly compatible legacy behavior until Feature 008.
- `XE-...` new order-number prefix: stop generating obsolete branding for new orders while preserving every historical number and URL.

### Rationale

The existing code already has useful security and transaction foundations: session-derived Customer association, profile completeness, owned addresses, service-role-only RPC execution, RLS-isolated orders, hashed guest confirmation cookies, atomic order/item/grant insertion, and adapter isolation. Its current checkout still accepts Product-only legacy items and calculates prices from Variant `base_price`, while the RPC trusts calculated totals. Incremental replacement preserves working behavior without carrying those trust gaps forward.

### Alternatives considered

- Rewrite checkout and Admin as separate applications: rejected by the constitution and unnecessary.
- Keep the current order API and merely ignore extra client fields: rejected because quote confirmation, Sellable Unit identity, idempotency, and race-safe final validation need a stronger contract.

## Commerce domain boundary

### Decision

Add a server-only `src/lib/commerce/` module that orchestrates existing domain interfaces without querying their internal tables ad hoc. Its intentional seams are:

- Customers: current Customer, effective Customer Type, profile completeness, owned address resolution.
- Catalog: batched active Variant/Sellable Unit validation, labels/SKU, independent sellability, conversion/base-equivalent snapshot.
- Pricing: Feature 004 batched resolver and final-transaction callable resolver seam.
- Commerce: quantity rules, normalization, quote calculation/fingerprint, confirmation, idempotency, finalization, safe errors, diagnostics.
- Existing adjustments: authoritative discount, card-discount compatibility, and shipping policy resolution moved behind explicit server interfaces.

Route Handlers stay thin HTTP adapters. Current Next.js 16 documentation confirms Route Handlers are uncached by default and must be treated as public endpoints; every protected handler performs its own authorization check. Fresh commerce reads do not opt into caching or Cache Components.

### Rationale

This preserves one modular monolith while giving storefront, checkout, Admin, tests, and future authorized tools the same business behavior.

### Alternatives considered

- Put rules in Product, Cart, and Checkout components: rejected because client code is not authoritative and would drift.
- Create a commerce microservice: rejected because there is no scale or ownership need that outweighs transactional and operational complexity.

## Quantity-rule persistence and resolution

### Decision

Use one `commerce_quantity_rules` table with `context_kind = public | customer_type`, nullable `customer_type_id`, required Variant/Sellable Unit target, positive integer `minimum_quantity` and `quantity_increment`, active/archive state, actor, and timestamps. Two partial unique indexes enforce at most one active non-archived rule:

- public: `(variant_id, sellable_unit_id)`
- customer type: `(customer_type_id, variant_id, sellable_unit_id)`

An atomic Admin command obtains a deterministic transaction-scoped advisory lock for the complete context, validates Unit ownership/sellability, deactivates the old rule, activates/inserts the replacement, and appends an audit event. The unique indexes are the race-condition backstop. Resolution batch-loads exact rules for all targets; public never falls through to Retail. Absence yields `minimum = 1`, `increment = 1`.

Quantity is valid exactly when:

```text
Number.isSafeInteger(quantity)
AND quantity >= minimumQuantity
AND (quantity - minimumQuantity) % quantityIncrement = 0
```

### Rationale

This is extensible to future Customer Types, deterministic, database-enforced, and consistent with the repository’s partial-unique/RPC patterns.

### Alternatives considered

- One nullable-key unique index: rejected because PostgreSQL null semantics would not enforce public uniqueness without special handling.
- Priority or newest-row-wins rules: rejected by clarification.
- Scheduled rules: rejected by clarification and unnecessary for Feature 005.
- UI-only conflict checks: rejected because concurrent writes could still create ambiguity.

## Canonical cart and legacy compatibility

### Decision

Version browser cart data and make its only required authority-free intent `{ variantId, sellableUnitId, quantity }`. A client key is derived from both IDs. Names, labels, image, price, stock, and rules may be disposable display snapshots.

On first read after cutover:

- canonical versioned lines are normalized and duplicate identities merged using checked integer addition;
- Variant-only lines migrate only when Catalog returns exactly one active independently sellable Unit for that Variant;
- Product-only lines migrate only when Product resolves to exactly one active Variant and that Variant to exactly one active independently sellable Unit;
- ambiguous, malformed, unavailable, or overflow lines remain visible as `needs_selection`/invalid recovery rows and cannot be quoted until corrected or removed.

### Rationale

This preserves Customer intent without guessing commercial meaning or breaking on stale `localStorage` JSON.

### Alternatives considered

- Clear all legacy carts: rejected because it needlessly loses recoverable intent.
- Select default Variant/Unit on ambiguity: rejected because silent substitution violates the specification.

## Persisted quote and confirmation model

### Decision

Persist checkout quotes server-side. A quote is scoped to either the authenticated Customer or a guest context represented by a 256-bit HttpOnly checkout cookie whose SHA-256 hash is stored. The browser receives only an opaque quote ID, revision, safe display DTO, and expiry.

Cart quote is stateless and not confirmable. Checkout quote includes normalized lines, destination snapshot/source, payment method, discount adjustments, shipping result, and totals. It is valid for 30 minutes, but final submission always revalidates. Confirmation locks the owned quote and records its current revision/fingerprint; it does not accept a browser fingerprint.

The commercial fingerprint is SHA-256 over a versioned canonical JSON representation with lines sorted by `(variantId, sellableUnitId)` and integer minor-unit amounts. It includes:

- public/effective Customer-Type commerce context;
- Variant, Sellable Unit, quantity, price, line total, base equivalent, quantity minimum/increment, and eligibility;
- payment method and every discount component;
- normalized destination identity, shipping policy/match and amount;
- subtotal, total discount, shipping, final total, and currency.

It excludes Product descriptions, marketing copy, images, sort/display order, and other non-commercial metadata. Safe change details are computed field-by-field for Customer display; equality is not based only on the grand total.

### Rationale

Persistence prevents fabricated confirmation, supports guest/authenticated ownership, allows deterministic comparison and lost-response recovery, and avoids embedding protected pricing internals in a signed browser payload.

### Alternatives considered

- Signed self-contained quote token: rejected because revocation, ownership, revision, diagnostics, and consumption are simpler and safer with persistence already required for idempotency.
- Client-generated hash: rejected because the browser could fabricate terms.
- Compare only final total: rejected because offsetting price/shipping or discount changes still require reconfirmation.
- Reconfirm on every submit: rejected because unchanged authoritative quotes should proceed.

## Race-safe final revalidation and transaction

### Decision

Make a new service-role-only `commerce_finalize_order` RPC the sole final order-creation boundary. It locks the owned confirmed quote and idempotency key, invokes callable authoritative Catalog, Pricing, quantity-rule, discount, and shipping functions within the same PostgreSQL transaction and transaction timestamp, builds the current canonical commercial document, and compares its fingerprint with the confirmed quote.

- Different or invalid: update the quote to a new unconfirmed revision when correctable, return `RECONFIRMATION_REQUIRED`/validation details, and create no order.
- Identical: insert Order, Order Lines, immutable snapshots, guest confirmation grant/customer audit, domain event, and idempotency result; mark the quote consumed; commit all or none.

Feature 003/004 prerequisite convergence must therefore expose callable database resolver functions wrapped by their TypeScript service APIs. Commerce calls those interfaces; it does not reproduce price precedence or conversion logic.

### Rationale

Application-only “revalidate then insert” leaves a race in which an Admin mutation or scheduled price boundary can occur between reads and the order transaction. One transaction and one database timestamp close that gap.

### Alternatives considered

- Revalidate in TypeScript then call the existing insert RPC: rejected because relevant records can change between the two operations.
- Global configuration revision lock: rejected because scheduled price validity can change with time without a write and a global row would create avoidable contention.
- Accept a very small race window: rejected for authoritative commercial terms.

## Idempotency and 24-hour deduplication

### Decision

Require a UUID submission identity generated once per Place Order attempt. Persist `checkout_submissions` with a derived scope hash, submission key, payload/fingerprint hash, first accepted time, 24-hour expiry, status, and result order.

The final RPC takes a transaction-scoped advisory lock on `(scopeHash, submissionKey)`. A permanent unique constraint on that pair prevents races while a row exists. Under the lock it removes or archives an expired unconsumed claim before reuse, then applies:

- existing, unexpired, same payload, completed → return the same safe order result;
- existing, unexpired, different payload → `IDEMPOTENCY_CONFLICT`;
- existing, unexpired, in progress → wait on the lock, then return committed result or retry safely;
- no active record → create the claim and order in the same transaction.

Validation and quote-change failures happen before accepting the submission claim, so the key is not poisoned. A database failure rolls back claim and order. Payment initialization happens after local order commit; retrying the same key returns the order and safely regenerates/resumes the provider URL without creating another order. Rows are retained at least 24 hours and cleaned by bounded maintenance after expiry.

### Rationale

Database uniqueness plus serialization works across processes and application instances and safely handles concurrent duplicate requests and lost responses.

### Alternatives considered

- In-memory map or disabled submit button: rejected because neither survives refresh, retry, multiple instances, or races.
- Time-dependent partial unique index: rejected because `now()` is not a safe immutable index predicate.
- Permanent never-expiring key semantics: rejected because the approved policy permits expiry and indefinite guest data is unnecessary.

## Monetary representation and calculations

### Decision

Consume Feature 004 integer EGP minor-unit amounts and calculate line totals, discounts, shipping, and totals with checked integer arithmetic. Persist minor-unit snapshots as authority while continuing to populate current `numeric(10,2)` order compatibility columns during the migration window. Apply adjustments in this order: line prices → subtotal → existing valid coupon and card-payment discount components → authoritative shipping/free-shipping policy → non-negative final total.

### Rationale

This prevents binary floating-point mismatch between quote, fingerprint, payment amount, and stored order while preserving current readers and integrations.

### Alternatives considered

- Continue JavaScript floating-point currency: rejected because fingerprints and gateway amounts require exact equality.
- Remove compatibility numeric columns immediately: rejected because existing Admin, confirmation, notification, shipping, and analytics consumers use them.

## Customer, guest, and saved-address security

### Decision

Resolve authenticated Customer and effective type from the session for every quote/confirm/finalize request. Require Feature 001 profile completeness. An authenticated checkout may supply an owned saved-address ID or an explicit delivery address; an ID is resolved with `customer_id = currentCustomer.id`, never by raw lookup. Guest checkout uses validated contact/address input and the hashed guest context cookie. Public DTOs contain no protected Price List, alternate tier, Customer, or audit internals.

### Rationale

This extends current session and confirmation-grant patterns while preventing identity/type/address spoofing and cross-Customer idempotency disclosure.

### Alternatives considered

- Trust submitted Customer/type/address objects: rejected by the trust boundary.
- Match Customers by phone: rejected because guest orders and persistent Customers are intentionally distinct.

## Admin operational design

### Decision

Extend the current protected Admin shell and primitives. Add Commerce/Pricing navigation only after Feature 004 is present. Dashboard attention uses `fulfillment_status = 'pending'` for all ages; it does not use payment pending, creation date, or read state. Add real counts for pending approvals, pending-fulfillment orders, active Products/Variants, Customers, and reliably detectable sellability/price/rule blockers.

Move Orders to server-side paginated queries with order number/name/phone/SKU search and status/payment/type/date filters. Add explicit guest/authenticated context, effective type snapshot, Sellable Unit and immutable commerce snapshots to detail. Link authenticated orders to a Customer detail or filtered Customer view. New snapshot-version orders cannot use the current arbitrary item editor; controlled editing remains Feature 008.

### Rationale

`fulfillment_status` is the current UI’s “Order status” and changes from `pending` to `processing`; `payment_status` remains pending for COD and would keep handled COD orders permanently in attention. Existing Admin styling and shipment panels are already operationally useful.

### Alternatives considered

- Count orders from the last day or unread orders: rejected by clarification.
- Build advanced reporting: rejected as Feature 021 scope.
- Replace the Admin design system: rejected because the current rebrand is authoritative.

## Events, integrations, and observability

### Decision

Persist a minimal `order.created` domain event in the order transaction with correlation/order IDs and non-sensitive snapshot references. Continue invoking Kashier, notifications, Meta, Bosta, and Mylerz through their existing adapters after commit; provider failure never changes core commercial truth. Adapter operations use stable order identity for safe retry, and automated tests mock/sandbox every external side effect. Do not build Feature 009’s subscription/automation engine.

Emit structured server diagnostics with correlation ID, stable code, target/count metadata, and no raw Customer-facing exception or protected pricing trace for: unavailable price, invalid quantity, quote change, idempotency conflict, payment initialization failure, and order transaction failure. Track quote/change/order outcomes; purchase analytics fires only after successful order creation.

### Rationale

This gives operations traceability and future event consumers without expanding into a general workflow platform.

### Alternatives considered

- Call providers inside the database transaction: rejected because remote failure/latency would hold locks and corrupt retry semantics.
- Fire-and-forget with no durable event/diagnostic: rejected because failures would be untraceable.

## Performance and scale

### Decision

Normalize and deduplicate cart targets before access. Resolve Catalog units, quantity rules, and prices in batch; avoid per-line calls. Checkout quote and finalization use a bounded cart of at most 100 canonical lines and quantities within safe integer and database bounds. Target p95 server processing below 750 ms for a 25-line cart under normal database conditions and below 2 seconds for a 100-line cart, excluding payment-provider latency. Do not cache Customer-specific quotes or prices in shared caches.

### Rationale

The limits prevent abusive payloads and N+1 behavior while comfortably covering normal B2B carts. Correctness remains more important than caching.

### Alternatives considered

- No line cap: rejected because it permits accidental/hostile query and payload amplification.
- Per-line resolver calls: rejected by the brief and performance requirements.
- Shared price/quote caching: rejected because context leakage and stale terms outweigh current benefit.

## Testing and deployment

### Decision

Use Vitest unit/route/integration tests and transactional PostgreSQL fixtures. Add savepoint/concurrency tests for partial unique constraints, resolver rules, quote fingerprinting, reconfirmation, final RPC atomicity, idempotency scope/payload/24-hour behavior, and immutable snapshots. Mock Kashier, Bosta, Mylerz, notifications, Meta, and analytics; use explicit sandbox smoke tests outside the normal suite.

Deploy additively: backup and preflight → prerequisite 003/004 convergence → Feature 005 schema/RLS/RPCs → dual-read snapshot compatibility → quote UI → authoritative order cutover → Admin operations → monitor. Never backfill invented Unit/pricing/rule meaning into historical orders. Roll back application traffic only while compatibility writes remain; retain quote/idempotency/audit/snapshot records and restore from backup for destructive database failure.

### Rationale

This matches repository migration/test practices while adding the missing race, security, and external-side-effect coverage required for Milestone 1.

### Alternatives considered

- One irreversible schema/UI cutover: rejected because missing prerequisites and live checkout risk require staged verification.
- Automated tests against live providers: rejected by the specification.
