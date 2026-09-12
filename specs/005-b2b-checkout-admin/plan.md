# Implementation Plan: B2B Cart, Checkout & Operational Admin Foundation

**Branch**: `005-b2b-checkout-admin` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)  
**Input**: Approved Feature 005 specification, five clarification decisions, technical planning brief, constitution, Features 001–004 artifacts, current repository implementation, and bundled Next.js 16.2.9 guidance.

## Summary

Add one Commerce orchestration domain to the existing Next.js/Supabase modular monolith. The browser submits only Variant + Sellable Unit + whole-number quantity, delivery, coupon, and payment intent. Commerce batch-validates Catalog identity, resolves the public/effective Customer-Type quantity rule and Feature 004 price, computes discount/shipping/totals in integer EGP minor units, persists a 30-minute authoritative quote, records explicit Customer confirmation, and finalizes through one database transaction that re-resolves current terms, compares the full commercial fingerprint, enforces 24-hour idempotency, and atomically writes immutable Order snapshots. The existing rebranded storefront/Admin and provider adapters are extended, not redesigned.

Repository truth requires a hard prerequisite gate: the checked-out code lacks Feature 003’s distinct Sellable Unit/conversion model and all Feature 004 implementation. These approved domains must converge before Feature 005 schema/application cutover; Commerce must not create substitutes for them.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16.2.9 App Router, React 19.2.4; PostgreSQL PL/pgSQL for transactional domain commands  
**Primary Dependencies**: Supabase JS/SSR 2.108/0.12, PostgreSQL/pgcrypto, Zod 4.4, existing `pg` migration/test runner; Feature 003 Catalog and Feature 004 Pricing domain interfaces  
**Storage**: Supabase PostgreSQL for rules, quotes, submissions, events, Orders, Lines, and immutable snapshots; browser `localStorage` remains intent-only  
**Testing**: Vitest 4 unit/Route Handler/integration tests, transactional PostgreSQL fixtures via `DIRECT_URL`, mocked/sandbox provider tests, `npm run lint`, `npm run test:customer-db`, `npm run build`, manual bilingual mobile acceptance  
**Target Platform**: Existing responsive Next.js storefront and `/admin` on the current deployment target; primary mobile width approximately 390 px  
**Project Type**: Existing single-project modular-monolith web application  
**Performance Goals**: No per-line N+1 access; p95 Commerce processing below 750 ms for 25 lines and below 2 seconds for the 100-line hard limit under normal database conditions, excluding payment-provider latency  
**Constraints**: Server-only commercial authority; exact EGP minor units; final re-resolution and insertion share one database transaction/timestamp; public and Customer-Type rules are distinct; no shared caching of personalized quotes/prices; 24-hour dedupe; preserve COD/Kashier/shipping/discount/integration behavior; no new lifecycle/inventory/reporting engine  
**Scale/Scope**: One application/database; up to 100 normalized lines per cart/quote; guest, Retail, Wholesale, Gym, and future data-defined Customer Types; additive migration of existing Orders and carts

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design. Implementation remains blocked by the prerequisite convergence gate below.*

- [x] Reuses the current Next.js/React/Supabase modular monolith and current rebranded Storefront/Admin rather than creating another application or redesign.
- [x] Defines intentional Customers, Catalog, Pricing, Commerce, Orders, Shipping/Discount, and adapter interfaces over one PostgreSQL source of truth.
- [x] Uses canonical Variant + Sellable Unit identity for cart, quantity, pricing, order lines, and base-equivalent snapshots; Product remains browse/snapshot context.
- [x] Keeps Customer/type/address resolution, pricing, eligibility, quantity validation, adjustments, quote comparison, idempotency, and order creation server/database-authoritative with atomic commands and audit records.
- [x] Persists `order.created`, keeps providers behind existing post-commit adapters, defines safe retry/diagnostic behavior, and does not introduce direct AI mutation or Feature 009 automation.
- [x] Requires targeted rule/fingerprint/tampering/concurrency/RLS/snapshot/provider tests plus Features 001–004 and full Milestone 1 regression.

No constitution violation is required by this design.

## Prerequisite Convergence Gate

Before any Feature 005 migration or application change:

1. Verify the deployed Feature 003 contract exposes distinct Sellable Units, Unit → Variant ownership, independent sellability, and authoritative conversion/base-equivalent resolution. The current branch does not.
2. Verify the deployed Feature 004 contract exposes batch pricing and a final-transaction-callable authoritative resolver for Variant + Sellable Unit and effective public/Customer contexts. The current branch contains planning only.
3. Verify expected active Units have a valid public/default price and migration-safe compatibility snapshots.
4. Record the verified physical object/function names in [data-model.md](./data-model.md); do not silently bind logical names to guessed schema.
5. Abort before writes if any object, ownership relationship, constraint, resolver, or coverage check fails.

The implementation sequence may execute unfinished Feature 003/004 tasks first, but ownership stays in those domains. Feature 005 cannot be marked started beyond scaffolding or complete while this gate fails.

## Project Structure

### Documentation (this feature)

```text
specs/005-b2b-checkout-admin/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── commerce-api.md
│   ├── admin-api.md
│   └── events-integrations.md
├── checklists/requirements.md
└── tasks.md                       # generated by /speckit.tasks
```

### Planned source changes

```text
src/
├── app/
│   ├── (storefront)/
│   │   ├── product/[slug]/page.tsx
│   │   ├── cart/page.tsx
│   │   └── checkout/{page,success,return}.tsx
│   ├── admin/(protected)/
│   │   ├── page.tsx
│   │   ├── commerce/quantity-rules/page.tsx
│   │   ├── customers/[customerId]/page.tsx
│   │   └── orders/{page,[id]/page}.tsx
│   └── api/
│       ├── commerce/
│       │   ├── cart-quote/route.ts
│       │   └── checkout-quotes/{route.ts,[quoteId]/confirm/route.ts}
│       ├── orders/route.ts
│       └── admin/commerce/quantity-rules/{route.ts,[ruleId]/route.ts}
├── components/
│   ├── storefront/{product-purchase-box,quantity-stepper,cart-quote,checkout-form,quote-change-alert}.tsx
│   └── admin/{quantity-rule-manager,operational-attention,orders-table,order-snapshot,status-badge}.tsx
└── lib/
    ├── cart.ts
    ├── commerce/
    │   ├── types.ts
    │   ├── validation.ts
    │   ├── context.ts
    │   ├── quantity-rules.ts
    │   ├── normalize-cart.ts
    │   ├── quote.ts
    │   ├── fingerprint.ts
    │   ├── confirmation.ts
    │   ├── finalization.ts
    │   ├── errors.ts
    │   ├── audit.ts
    │   └── diagnostics.ts
    ├── data/{orders,admin}.ts
    └── pricing/                     # delivered by Feature 004 prerequisite

supabase/
├── migrations/005_b2b_checkout_admin.sql
└── schema.sql

scripts/
├── migrate-feature-005.mjs
└── seed-feature-005-commerce.mjs

tests/
├── helpers/{commerce-fixtures,commerce-test-db,provider-mocks}.ts
├── unit/commerce/{quantity-rules,cart-normalization,fingerprint,change-diff,money}.test.ts
└── integration/commerce/{migration-rls,cart-quote,checkout-quote,finalization,idempotency,admin-operations,milestone-1}.test.ts
```

**Structure Decision**: Extend the existing single App Router project. `src/lib/commerce/` owns orchestration and exposes typed server-only functions; Route Handlers validate/authorize/serialize; PostgreSQL functions own invariants and the final transaction. Existing Customer, Catalog, Pricing, order-history, Admin, and provider modules remain their domain owners.

## Repository Audit: Reuse and Replacement

| Area | Current evidence | Plan |
|---|---|---|
| Customer/session/profile | `src/lib/customers/*`; session-derived Customer, profile completeness, addresses, RLS | Reuse; resolve on every request and verify saved address with current Customer ID. |
| Type approval | `customer_types`, request/audit tables and approval/assignment RPCs | Reuse canonical `customers.customer_type_id`; never inspect pending requests for benefits. |
| Catalog | `product_variants`, attributes/media and `resolvePurchasableVariants()` | Reuse Product/Variant; complete missing Sellable Unit/conversion contract in Feature 003 before 005. |
| Pricing | only legacy `src/lib/pricing.ts` subtotal/card-discount helpers exist | Complete Feature 004 first; Commerce calls its resolver and minor-unit primitives, never raw price tables/base price. |
| Cart | `src/lib/cart.ts` stores Variant/Product identity, price, stock and merges by `id` | Version and migrate to Variant + Sellable Unit identity; stored price/stock/rules are display-only. |
| Cart page | client subtotal and free-shipping progress from cached prices | Replace commercial display with current cart quote; retain interaction/brand patterns. |
| Checkout | current client form calls shipping and `/api/orders` directly | Split quote, explicit confirmation, and final submission; retain delivery UX/payment choices. |
| Shipping/discount | `getShippingCostForProducts()`, `resolveDiscount()`, 450 ml/free-shipping/card-discount behavior | Move behind authoritative callable interfaces used by quote and final RPC; preserve order of calculation. |
| Order creation | `createOrder()` calculates in JS; `customer_create_order` atomically inserts but accepts totals | Supersede with `commerce_finalize_order`; retain guest grant/customer audit behavior. |
| Guest confirmation | 256-bit secret, hashed DB grant, HttpOnly cookie | Reuse pattern with a separate guest checkout context; never put secrets in URLs. |
| Kashier/COD | Order is created first; Kashier amount comes from saved total; webhook updates payment | Preserve, but use final authoritative minor total and idempotent retry recovery. |
| Notifications/Meta | `after()` post-order adapters | Preserve post-commit execution; dedupe on stable order/event identity and log failures. |
| Admin shell | protected layout, bilingual sidebar, PageHeader/StatCard/SectionCard, current rebrand | Extend existing navigation/components; no second Admin or redesign. |
| Dashboard | orders today/revenue/products/low stock/pending approvals/recent orders | Refocus attention on pending approvals, `fulfillment_status=pending`, and reliable commerce blockers; retain concise summary. |
| Admin Orders | newest 100 then client filters; editable lines/totals | Server pagination/search/filter, richer snapshots; reject item edits for snapshot-v1 orders. |
| Order numbers | new values use obsolete `XE-` prefix | Generate new KeepFit-prefixed values after cutover; preserve all historical numbers and routes. |

## Technical Architecture

```text
Browser cart intent
      │
      ▼
uncached Route Handler ── resolve session or guest checkout context
      │
      ▼
Commerce Quote Service
      ├── Customer/effective type + owned address
      ├── Catalog Variant/Unit/sellability/conversion (batch)
      ├── Feature 004 price resolver (batch)
      ├── Quantity Rule resolver (batch, public OR type)
      ├── Discount/card adjustment
      └── Shipping/free-shipping policy
      │
      ▼
Persisted checkout quote + canonical fingerprint
      │ explicit confirm of owned revision
      ▼
commerce_finalize_order transaction
      ├── serialize scope + submission key
      ├── lock quote
      ├── re-resolve all authoritative terms at one DB timestamp
      ├── compare full fingerprint
      ├── changed → new draft revision, no Order
      └── same → Order + Lines + snapshots + event + dedupe result
      │
      ▼
post-commit COD/Kashier + notifications/Meta; Admin/customer reads
```

### Server trust boundary

Accepted Customer intent is limited to canonical IDs/quantity, address choice/input, coupon code, notes, payment method, opaque quote ID/revision, and submission UUID. The service schemas strip/reject price, totals, Customer/type/list IDs, rule values, packaging conversion/base quantity, and client timestamps. Every Admin mutation independently calls existing Admin authorization before service-role access.

### Quantity-rule algorithm

1. Deduplicate all Variant/Unit targets and validate at most 100 lines.
2. Derive `public` for guest or effective Customer Type ID for authenticated Customer.
3. Batch-load exact active non-archived rules for that one context and all targets.
4. For each target, use exact row or 1/1 fallback; never public↔Retail fallback.
5. Validate safe integer, `q >= minimum`, and `(q - minimum) mod increment = 0`.
6. Return safe rule guidance and error; snapshot the resolved values on successful order.

The Admin set/replace RPC serializes one complete context with an advisory transaction lock and relies on partial unique indexes as final enforcement.

### Quote, confirmation, and change boundary

Cart quote is ephemeral and may omit shipping/final total. Checkout quote is persisted for 30 minutes and includes full validated delivery/payment context. Confirmation records the server-owned current revision/fingerprint. Final submission always re-resolves.

Fingerprint uses versioned canonical JSON, sorted lines/adjustments, stable base-10 integer strings, and SHA-256. It includes identity, quantity, context, eligibility/minimum/increment, unit/line prices, base equivalent, discounts, shipping policy/amount/destination, payment method, and all totals. It excludes description, image, marketing copy, and display ordering. Any included field change—even with an equal final total—requires reconfirmation; identical results proceed without another prompt.

### Transaction and idempotency boundary

`commerce_finalize_order` is SECURITY DEFINER with empty search path and service-role-only execute. Under one transaction and transaction timestamp it:

1. derives/validates authenticated Customer or hashed guest scope passed only from trusted server context;
2. takes an advisory lock on `(scopeHash, submissionId)` and resolves an unexpired submission;
3. safely returns the existing Order for same-payload replay or rejects changed-payload reuse;
4. locks the owned confirmed quote and verifies revision/expiry;
5. calls the authoritative Catalog/Pricing/quantity/discount/shipping resolver seams;
6. refreshes quote and returns `RECONFIRMATION_REQUIRED` without accepting the idempotency record when terms changed;
7. otherwise inserts the submission claim, Order, Lines, all snapshots, confirmation grant/customer audit, and `order.created`; consumes quote; links result; commits.

The persisted uniqueness constraint prevents duplicate races across application instances. The dedupe record expires 24 hours after first acceptance. Provider initialization occurs after commit, so retry returns the Order and resumes the provider path.

### Order snapshot and Feature 006 boundary

Add nullable fields and `commerce_snapshot_version`. New version-1 orders require Customer/public context, quote/submission/fingerprint, minor-unit totals, adjustment/shipping snapshots, and complete Variant/Sellable Unit/packaging/price/quantity-rule line snapshots. Legacy rows remain readable without fabricated backfill. Compatibility decimal columns stay synchronized for existing readers/providers.

Preserve `payment_status` and `fulfillment_status`; the current initial operational Order status is `fulfillment_status = 'pending'`. Feature 005 adds no transitions or free text. Feature 006 can introduce a controlled state machine over the stable Order, Customer, line, and commercial snapshot identities without changing checkout truth.

## Interface Contracts

- Customer/storefront interfaces: [contracts/commerce-api.md](./contracts/commerce-api.md)
- Admin quantity/dashboard/order interfaces: [contracts/admin-api.md](./contracts/admin-api.md)
- Events and provider behavior: [contracts/events-integrations.md](./contracts/events-integrations.md)

All public DTOs are minimum safe projections. Protected pricing source references, guest hashes/secrets, cross-Customer existence, raw SQL errors, and stack traces stay server-only.

## Database and Migration Plan

### Schema additions

- `commerce_quantity_rules` plus two partial unique indexes and target/context checks.
- append-only `quantity_rule_audit_events`.
- private `checkout_quotes` with scope, revision/lifecycle, private canonical document, safe projection, fingerprint, confirmation, expiry, and consumption.
- private `checkout_submissions` with scope/key uniqueness, payload binding, 24-hour timestamps, state, and unique Order result.
- additive Order and Order Line commerce snapshot fields described in [data-model.md](./data-model.md).
- minimal `order_domain_events` for transactional `order.created` facts.
- attention/filter/search indexes for fulfillment status, payment method, Customer-Type snapshot, dates, and SKU.
- versioned callable resolver/finalization/admin command functions, RLS, revokes, and service-only grants.

### Migration order

1. Back up production and rehearse restore in staging.
2. Apply/verify the missing Feature 003 Sellable Unit/conversion migration.
3. Apply/verify Feature 004 Pricing and public/type price coverage.
4. Run Feature 005 preflight using `to_regclass`, information schema, constraint, resolver, ownership, and price-coverage checks; acquire a migration advisory lock.
5. Add Feature 005 tables/nullable columns/checks/indexes/RLS/grants/functions in one transaction and update canonical `supabase/schema.sql`.
6. Deploy dual-read Order/Admin/customer history support while legacy creation remains available.
7. Deploy quantity Admin and quote endpoints/UI behind the authoritative path.
8. Cut `/api/orders` to the new quote-only finalization contract and revoke/retire application access to the legacy money-accepting RPC.
9. Enable attention/search/detail additions, monitor errors/dedupe/provider outcomes, and complete Milestone 1 acceptance.

No migration creates production quantity rules by default. Non-production fixtures demonstrate public/Retail/Wholesale/Gym rules. Historical Orders remain untouched except additive null columns.

### Rollback

- Preflight failure: transaction performs no writes; fix prerequisite data/schema and retry.
- Post-schema/pre-cutover: roll application back; additive tables/columns are inert and retained.
- Post-cutover: roll application back only to a version proven to dual-write/read compatibility totals and snapshots; do not reactivate client-price authority.
- Preserve Order, Line, quote, idempotency, audit, event, and pricing/rule history; never drop them as an emergency rollback.
- Restore the tested backup only for destructive/corrupt migration failure, then reconcile Order counts, numbers, totals, consumed quotes, and provider references before reopening checkout.

## Storefront Integration Plan

1. Add Sellable Unit selection to Product detail after Variant selection; fetch current-context price and quantity rule together.
2. Initialize quantity at the minimum and step by increment; disable non-sellable targets but retain server validation.
3. Write version-2 canonical cart identity and defensive migration/recovery states; merge only exact compatible identities.
4. Replace local Cart totals/free-shipping truth with batched quote state, loading/error/change guidance, and retained invalid lines.
5. Revalidate on cart open, login/logout, return after type approval, checkout begin, and explicit retry; server changes are naturally detected on every uncached quote.
6. Build Checkout around a persisted full quote, owned saved/ad-hoc address, payment/coupon context, explicit confirmation, and submission UUID stable across retries.
7. On `RECONFIRMATION_REQUIRED`, keep intent, render all safe changed components, replace draft revision, and require confirmation again.
8. Clear/transition only after successful authoritative Order response; card redirects use committed Order amount/reference.
9. Reuse current design tokens, bilingual provider, touch controls, focus styles, and mobile sticky action; add accessible live regions for quote/rule/change errors.

## Admin Operational Plan

1. Add Quantity Rules under current Commerce navigation with explicit Public versus Customer-Type context and Product → Variant → Sellable Unit selection.
2. Use atomic set/replace/deactivate commands and show 1/1 fallback when no row exists; never imply fallback is a stored rule.
3. Replace decorative-first dashboard emphasis with “Needs Your Attention”: pending type requests, all `fulfillment_status=pending` Orders, missing sellable Units/prices, and genuinely invalid rules. Each count links to its filtered operational view.
4. Keep concise Customer/Product/Variant/Order/value summary and recent Orders without building Feature 021 analytics.
5. Move Admin Orders to server pagination, query, and filters; include order number, guest/Customer, type snapshot, total, payment/current fulfillment, and shipping summary.
6. Extend detail with immutable selected Unit/base-equivalent/quantity rule/price source/line and total snapshots and a persistent Customer link when present.
7. Reject current item-replacement editing for version-1 authoritative Orders; retain notes, existing statuses, and carrier panels under current permissions until owning features replace them.
8. Consolidate touched status badge/label behavior for bilingual accessible Admin use; do not broaden lifecycle semantics.

## Security, RLS, and Audit

- Public: may request only its own current safe quote/result; cannot read tables or alternate price/rule contexts.
- Customer: session owns quote/submission/order/address scope; cannot submit Customer/type/list identity or access another Customer’s quote, key, address, or Order.
- Admin: existing `profiles.is_admin` authorization is checked inside every route/action before service-role access; quantity rule mutation and operational reads are audited/scoped.
- New tables enable RLS; direct anon/authenticated privileges are revoked. SECURITY DEFINER functions use empty search path, schema qualification, bounded input, and service-role-only execute.
- Store only hashes for guest checkout and confirmation capabilities; cookies are HttpOnly, SameSite Lax, Secure in production, path-scoped, random, and bounded.
- Stable safe errors and correlation IDs cover invalid quantity, unavailable price/unit, quote change, idempotency conflict, payment initialization, and transaction failure.
- Logs exclude raw address/contact payloads, secrets, protected Price List/source detail, and SQL errors from Customer responses.

## Performance and Reliability

- Deduplicate targets and use one batched Catalog graph, quantity-rule set, and Feature 004 price operation per quote/finalization.
- Keep a hard 100-line request limit, checked safe integer quantities, bounded strings, and database numeric limits.
- Use indexed server pagination for Admin; no load-all-and-filter path for full operational history.
- Do not share-cache session pricing/quotes. Route Handlers remain uncached; finalization uses database transaction time.
- Unique indexes and advisory locks protect concurrent rule replacement and duplicate submissions across instances.
- Quote expiry bounds stale/private data; final revalidation makes expiry a UX/storage limit, not the correctness mechanism.
- Provider failures occur after core commit, are logged, and can retry against stable Order/event identity.

## Testing Strategy

### Unit and contract tests

- quantity resolver: no public row → 1/1; explicit public independent of Retail; Retail/Wholesale/Gym effective type; exact increment formula; boundary/overflow/fractional rejection;
- normalization: Variant + Unit merge identity, Box/Ampoule separation, unambiguous legacy migration, ambiguous recovery, malformed storage;
- fingerprint: deterministic ordering, every commercial field changes hash, offsetting values still change, non-commercial description/image changes do not;
- fixed-point line/discount/shipping/final arithmetic and serialization;
- validation/error DTOs reject extra authority fields and never expose protected source/PII.

### Database, route, and concurrency tests

- migration preflight, reapplication, partial unique rule indexes, context checks, target ownership, RLS/grants, Admin-only commands and audit;
- batch quote for guest/Retail/Wholesale/Gym and Feature 004 direct list/override/derived packaging paths;
- price=1, type spoof, quantity below minimum, fake conversion/base quantity, shipping=0, and 100%-discount tampering;
- saved-address cross-Customer denial, quote/submission cross-scope indistinguishable 404, guest hash isolation;
- price/rule/type/Unit/coupon/shipping changes require reconfirmation; unchanged quote proceeds; same final total with offsetting changes still blocks;
- same submission immediate/network/lost-response/payment retry returns one Order; changed payload conflicts; other Customer learns nothing; expired behavior is bounded;
- concurrent identical finalization produces one Order via real separate database connections, not merely sequential mocks;
- injected line/event/grant failure leaves no partial Order/submission consumption; successful Order persists complete immutable snapshots;
- later Product/Variant/Unit/conversion/price/rule/type/address changes do not alter history;
- snapshot-v1 Admin item editing is rejected; legacy compatibility remains explicit;
- Admin dashboard initial-status count and links, Customer/type/SKU/date/payment/status order search/filter/detail.

### Regression and external isolation

- Feature 001: Google login, profile, addresses, guest/auth ownership, My Orders, secure guest confirmation.
- Feature 002: Retail default; Wholesale/Gym request approval/rejection/supersession; effective type authority.
- Feature 003: Product/Variant/Unit/attributes/conversion/media/SKU identity.
- Feature 004: public/Retail/Wholesale/Gym/direct/override/scheduled/derived prices and protected-source security.
- COD and mocked/sandbox Kashier always use committed authoritative total.
- Mock Bosta/Mylerz, notifications/Telegram, Meta, analytics; assert no live charge/shipment/message and no purchase event before success or on replay.
- Manual Arabic RTL/English LTR tests at approximately 390 px: no overflow, touch-friendly Unit/quantity controls, readable rules/prices/totals/change alerts, clear loading/error/empty states.

## Implementation Phases

### Phase A — Prerequisites and audit

Converge/verify Feature 003 Sellable Units/conversions and Feature 004 pricing; record physical contracts; add migration/test scaffolds; freeze reuse/replacement map. Stop on gate failure.

### Phase B — Quantity-rule foundation

Add tables/checks/partial unique indexes/RLS/audit and atomic Admin commands; implement batch resolver, 1/1 fallback, exact integer algorithm, fixtures, and management UI.

### Phase C — Commerce quote service

Implement canonical cart normalization and recovery, batched Catalog/Pricing/rule resolution, fixed-point adjustments/shipping, safe quote DTOs, canonical document/fingerprint, and observability.

### Phase D — Checkout confirmation

Add guest context cookie, persisted quotes, 30-minute lifecycle, explicit owned revision confirmation, safe component diff, reconfirmation UI, and unchanged-quote path.

### Phase E — Idempotent order finalization

Add submission persistence/locks/uniqueness, 24-hour semantics, final-transaction resolvers, atomic Order/Line/snapshot/grant/audit/event writes, retry recovery, and versioned legacy RPC cutover.

### Phase F — Storefront integration

Integrate Unit/rule/price selection, versioned cart, quote-based Cart and Checkout, login/type/catalog change recovery, mobile/bilingual accessibility, cart clearing, COD/Kashier redirects, and confirmation/history snapshots.

### Phase G — Admin foundation

Implement actionable dashboard, rule management, server Orders search/filter/pagination, snapshot detail, Customer link, commerce blockers, immutable new-Order guard, and rebranded navigation/status primitives.

### Phase H — Security, regression, deployment, and Milestone closure

Run tampering/RLS/race/atomicity/snapshot suites, Features 001–004 regression, mocked integrations, lint/build, staging migration/rollback rehearsal, manual bilingual mobile acceptance, external sandbox checks, and the full guest/Wholesale Milestone 1 journeys.

## Milestone 1 Closure and Reporting

Feature 005 closes only when public and Customer-Type rules, one-active invariant, batched authoritative quotes, explicit confirmation/change behavior, current pricing/discount/shipping, 24-hour concurrent idempotency, atomic snapshots, guest/Retail/Wholesale/Gym and packaging journeys, Admin Orders/attention, current rebrand, targeted tests, regressions, and production build all pass.

Perform a requirement reconciliation against Features 001–005 and classify every item as implemented, existing and verified, or deferred to a named Feature. Closure reporting has four independent sections:

```text
AUTOMATED PASS / FAIL
MANUAL ACCEPTANCE PASS / PENDING
EXTERNAL SANDBOX PASS / PENDING
KNOWN DEFERRED ITEMS
```

Automated success alone is not production acceptance. Features 006–022 remain deferred exactly as specified.

## Post-Design Constitution Re-check

- [x] Modular-monolith ownership remains explicit; absent prerequisites are gated instead of duplicated.
- [x] Customer, Variant, Sellable Unit, pricing, rules, quotes, Orders, and snapshots have one database source of truth.
- [x] Browser authority is limited to intent; final commercial validation and writes share one transaction.
- [x] Admin authorization, RLS, audit, immutable history, provider boundaries, and retry behavior are defined.
- [x] The test/deploy/rollback plan protects existing capabilities and requires real Milestone 1 evidence.

The design is constitution-compliant and contains no unresolved planning decision. Implementation readiness remains conditional on the explicit Feature 003/004 prerequisite gate.
