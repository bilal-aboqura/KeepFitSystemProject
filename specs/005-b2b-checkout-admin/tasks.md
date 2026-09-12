# Tasks: B2B Cart, Checkout & Operational Admin Foundation

**Input**: Design documents from `specs/005-b2b-checkout-admin/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Targeted automated tests are mandatory for the commercial authority, pricing, quantity, authorization, transaction, idempotency, order snapshot, payment, and integration boundaries in this feature. Write each listed test before its corresponding implementation and confirm that it fails for the intended reason.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified as a distinct increment. Phase 2 is a hard convergence gate: no Feature 005 schema cutover or user-story implementation may begin until the missing Feature 003 Sellable Unit and Feature 004 Pricing contracts pass their preflight tests.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on another incomplete task in the same phase.
- **[Story]**: Maps the task to its user story for traceability.
- Every task names the exact repository file or files it changes.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the focused commands and reusable test scaffolding needed for prerequisite and Commerce work.

- [ ] T001 Add Feature 005 migration, fixture, and focused Commerce test scripts to `package.json`
- [ ] T002 [P] Create transactional Commerce database and fixture helpers with bounded cleanup in `tests/helpers/commerce-test-db.ts` and `tests/helpers/commerce-fixtures.ts`
- [ ] T003 [P] Create fail-closed Kashier, Bosta, Mylerz, notification, Meta, and analytics mocks in `tests/helpers/provider-mocks.ts`

---

## Phase 2: Foundational Prerequisite Convergence (Blocking)

**Purpose**: Converge the approved Catalog and Pricing contracts, bind their physical database interfaces, and install the shared Feature 005 schema/security foundations.

**CRITICAL**: T004-T013 are the hard prerequisite gate. The Feature 005 migration in T015 must refuse all writes until those checks pass.

- [ ] T004 Add failing database contract tests for distinct Sellable Units, Unit-to-Variant ownership, independent sellability, conversion resolution, public pricing coverage, batched pricing, and transaction-callable pricing in `tests/integration/commerce/prerequisite-contracts.test.ts`
- [ ] T005 Complete the Feature 003-owned Sellable Unit, Variant ownership, sellability, and conversion schema without Commerce-owned substitutes in `supabase/migrations/003_catalog_variants_media.sql` and `supabase/schema.sql`
- [ ] T006 Expose batched Sellable Unit identity, labels, SKU, sellability, and base-equivalent resolution through Catalog-owned types and queries in `src/lib/catalog/types.ts`, `src/lib/catalog/queries.ts`, and `src/lib/catalog/variants.ts`
- [ ] T007 Make the Feature 003 regression cover Box/Ampoule separation, conversion integrity, archived units, and ambiguous targets in `tests/integration/catalog-variants-media.test.ts`
- [ ] T008 Add failing fixed-point and context-precedence tests for Feature 004 public, Retail, Wholesale, Gym, direct, override, scheduled, and derived Unit pricing in `tests/unit/pricing/resolver.test.ts` and `tests/integration/pricing/contextual-pricing.test.ts`
- [ ] T009 Implement the Feature 004-owned Price List, mapping, override, schedule, and immutable price-source schema in `supabase/migrations/004_contextual_pricing.sql` and mirror it in `supabase/schema.sql`
- [ ] T010 Implement checked EGP minor-unit primitives and the batched authoritative Pricing resolver in `src/lib/pricing/types.ts`, `src/lib/pricing/money.ts`, and `src/lib/pricing/resolver.ts`
- [ ] T011 Implement the schema-qualified, transaction-time Feature 004 database resolver callable by final order creation in `supabase/migrations/004_contextual_pricing.sql`
- [ ] T012 Add the Feature 004 migration runner with schema, privilege, coverage, and reapplication checks in `scripts/migrate-feature-004.mjs`
- [ ] T013 Make the prerequisite suite pass, then replace logical placeholders with verified physical relation, column, constraint, and resolver names in `specs/005-b2b-checkout-admin/data-model.md`
- [ ] T014 Add failing migration tests for Feature 005 checks, indexes, RLS, revokes, service-only grants, reapplication, and legacy Order preservation in `tests/integration/commerce/migration-rls.test.ts`
- [ ] T015 Implement a no-write prerequisite preflight, migration advisory lock, schema application, and convergent verification in `scripts/migrate-feature-005.mjs`
- [ ] T016 Add quantity-rule and append-only rule-audit tables, checks, foreign keys, partial unique indexes, RLS, and grants in `supabase/migrations/005_b2b_checkout_admin.sql`
- [ ] T017 Add private checkout quote and submission tables with scope, lifecycle, fingerprint, expiry, consumption, payload-binding, and uniqueness constraints in `supabase/migrations/005_b2b_checkout_admin.sql`
- [ ] T018 Add nullable legacy-compatible Order and Order Item snapshot fields, minor-unit checks, `order_domain_events`, operational indexes, and RLS/grants in `supabase/migrations/005_b2b_checkout_admin.sql`
- [ ] T019 Mirror all verified Feature 005 relations, functions, constraints, indexes, RLS policies, revokes, and grants into `supabase/schema.sql`
- [ ] T020 [P] Define server-only Commerce intents, safe DTOs, result unions, snapshot types, and stable error codes in `src/lib/commerce/types.ts` and `src/lib/commerce/errors.ts`
- [ ] T021 [P] Implement correlation-safe audit and diagnostics primitives that redact PII, SQL errors, guest secrets, and protected pricing sources in `src/lib/commerce/audit.ts` and `src/lib/commerce/diagnostics.ts`
- [ ] T022 Implement session-derived Customer/effective-type/profile/address context and hashed 256-bit guest checkout cookie handling in `src/lib/commerce/context.ts`

**Checkpoint**: The Catalog and Pricing prerequisite contracts are physically verified, Feature 005 migration tests pass, and the shared server-only foundation is ready. Only now may user-story work begin.

---

## Phase 3: User Story 1 - Complete an Authoritative Guest or Customer Order (Priority: P1) 🎯 MVP

**Goal**: Let a guest or authenticated Retail Customer select one canonical Variant/Sellable Unit, receive authoritative current totals, confirm delivery/payment terms, and create one secure COD or card Order.

**Independent Test**: Complete one guest and one authenticated Retail purchase from Product detail through confirmation using manipulated browser money and identity fields; verify current server totals, owned-address enforcement, profile recovery, order history, guest confirmation, COD, and enabled card behavior.

### Tests for User Story 1

- [ ] T023 [P] [US1] Add failing contract tests that reject unknown authority fields and validate the cart quote, checkout quote, confirm, and order DTO/error vocabulary in `tests/integration/commerce/commerce-routes.test.ts`
- [ ] T024 [P] [US1] Add failing guest and authenticated Retail checkout tests for profile completeness, owned/ad-hoc addresses, authoritative totals, cart retention, and secure confirmation in `tests/integration/commerce/authoritative-checkout.test.ts`
- [ ] T025 [P] [US1] Add failing COD and Kashier preparation tests proving provider amounts come only from the committed authoritative total in `tests/integration/commerce/payment-preparation.test.ts`

### Implementation for User Story 1

- [ ] T026 [P] [US1] Implement strict Zod schemas for at most 100 canonical lines, safe integer quantities, delivery choices, coupons, payment intent, quote confirmation, and order submission in `src/lib/commerce/validation.ts`
- [ ] T027 [US1] Implement batched cart normalization against Catalog identity, active/sellable state, availability, default quantity eligibility, and Feature 004 pricing in `src/lib/commerce/normalize-cart.ts`
- [ ] T028 [US1] Implement checked minor-unit subtotal, existing discount/card adjustment, shipping/free-shipping, final-total, and safe projection assembly in `src/lib/commerce/quote.ts`
- [ ] T029 [US1] Add the uncached authoritative cart validation endpoint in `src/app/api/commerce/cart-quote/route.ts`
- [ ] T030 [US1] Persist scoped 30-minute checkout quotes and delivery/payment snapshots without accepting Customer, type, price, rule, shipping, or total authority in `src/lib/commerce/quote.ts`
- [ ] T031 [US1] Add the create/refresh checkout quote endpoint and issue the guest checkout cookie when required in `src/app/api/commerce/checkout-quotes/route.ts`
- [ ] T032 [US1] Implement owned quote locking, expiry/revision validation, and explicit server-fingerprint confirmation in `src/lib/commerce/confirmation.ts` and `src/app/api/commerce/checkout-quotes/[quoteId]/confirm/route.ts`
- [ ] T033 [US1] Implement the initial atomic confirmed-quote Order creation command and route cutover without browser-supplied money in `src/lib/commerce/finalization.ts`, `supabase/migrations/005_b2b_checkout_admin.sql`, and `src/app/api/orders/route.ts`
- [ ] T034 [P] [US1] Add active Sellable Unit selection, current price/rule loading, and accessible quantity controls to `src/app/(storefront)/product/[slug]/page.tsx`, `src/components/storefront/product-purchase-box.tsx`, and `src/components/storefront/quantity-stepper.tsx`
- [ ] T035 [US1] Replace cached-price cart truth with batched quote loading, invalid-line retention, correction/removal, and retry states in `src/app/(storefront)/cart/page.tsx` and `src/components/storefront/cart-quote.tsx`
- [ ] T036 [US1] Build saved/ad-hoc delivery, coupon, COD/card intent, quote review, explicit confirmation, stable submission UUID, and failure recovery in `src/app/(storefront)/checkout/page.tsx` and `src/components/storefront/checkout-form.tsx`
- [ ] T037 [US1] Use committed Order identity and totals across checkout success/return, customer history/detail, secure guest confirmation, and Kashier redirects in `src/app/(storefront)/checkout/success/page.tsx`, `src/app/(storefront)/checkout/return/page.tsx`, `src/lib/data/orders.ts`, and `src/lib/kashier.ts`
- [ ] T038 [US1] Add bilingual Arabic/English labels, live-region errors, focus recovery, and profile/cart recovery copy for the US1 journey in `src/lib/i18n/translations.ts`

**Checkpoint**: US1 passes independently for guest and Retail checkout using the default 1/1 quantity rule and authoritative public/effective pricing.

---

## Phase 4: User Story 2 - Buy Under Approved B2B Pricing and Quantity Rules (Priority: P1)

**Goal**: Apply one data-defined public or effective Customer-Type quantity rule and Feature 004 price to guest, Retail, Wholesale, Gym, and future types while preserving selected Units as distinct cart lines.

**Independent Test**: Configure different rules for one Variant/Unit and prove guest, Retail, pending Wholesale, approved Wholesale, and approved Gym contexts resolve the correct price and exact minimum/increment; Box and Ampoule remain separate even when base-equivalent quantities match.

### Tests for User Story 2

- [ ] T039 [P] [US2] Add failing unit tests for public/type isolation, 1/1 fallback, safe integers, boundaries, overflow, fractions, and `(quantity - minimum) % increment` in `tests/unit/commerce/quantity-rules.test.ts`
- [ ] T040 [P] [US2] Add failing cart-storage tests for Variant/Unit merge identity, Box/Ampoule separation, checked merging, unique legacy migration, ambiguity, unavailability, and malformed JSON in `tests/unit/commerce/cart-normalization.test.ts`
- [ ] T041 [P] [US2] Add failing database/route matrix tests for guest, Retail, pending request, Wholesale, Gym, future type, derived Unit pricing, and no per-line N+1 calls in `tests/integration/commerce/b2b-context-matrix.test.ts`

### Implementation for User Story 2

- [ ] T042 [US2] Implement one batched exact-context quantity-rule resolver with public/type isolation and 1/1 fallback in `src/lib/commerce/quantity-rules.ts`
- [ ] T043 [US2] Version browser cart intent as Variant plus Sellable Unit plus quantity, merge only exact compatible identities, and retain blocked legacy recovery rows in `src/lib/cart.ts`
- [ ] T044 [US2] Integrate effective Customer-Type pricing and rule guidance into Product selection without type-specific pages or client-selected contexts in `src/components/storefront/product-purchase-box.tsx` and `src/app/(storefront)/product/[slug]/page.tsx`
- [ ] T045 [US2] Revalidate cart quote state after login, logout, type approval, cart open, checkout entry, and explicit retry in `src/components/storefront/cart-quote.tsx` and `src/app/(storefront)/cart/page.tsx`
- [ ] T046 [US2] Add removable non-production public, Retail, Wholesale, and Gym Box/sub-package pricing and quantity fixtures in `scripts/seed-feature-005-commerce.mjs`

**Checkpoint**: US2 passes independently against all effective commerce contexts with exact Unit identity and no hardcoded Retail/Wholesale/Gym checkout branch.

---

## Phase 5: User Story 3 - Review Changed Terms Before Placing an Order (Priority: P1)

**Goal**: Detect every confirmed commercial change, return a safe field-level diff, preserve correctable intent, and require explicit reconfirmation before finalization.

**Independent Test**: Confirm a quote, then independently change price, discount, shipping, total, Customer Type, rule, Variant/Unit eligibility, and offsetting monetary components; every commercial change creates no Order and requires review, while description/image/order-only changes do not.

### Tests for User Story 3

- [ ] T047 [P] [US3] Add failing canonicalization tests for deterministic sorted JSON, integer serialization, every commercial field, offsetting changes, and excluded display-only fields in `tests/unit/commerce/fingerprint.test.ts`
- [ ] T048 [P] [US3] Add failing safe-diff tests for line identity, eligibility, quantity rule, price, adjustment, shipping, payment, and total change codes in `tests/unit/commerce/change-diff.test.ts`
- [ ] T049 [P] [US3] Add failing quote lifecycle and final revalidation tests for expiry, ownership, revision conflict, unchanged completion, and each reconfirmation trigger in `tests/integration/commerce/checkout-quote.test.ts`

### Implementation for User Story 3

- [ ] T050 [US3] Implement versioned canonical commercial documents, stable sorting, base-10 minor strings, SHA-256 fingerprints, and non-commercial exclusions in `src/lib/commerce/fingerprint.ts`
- [ ] T051 [US3] Implement stable Customer-safe component diffs and reconfirmation error mapping without protected source or PII disclosure in `src/lib/commerce/errors.ts`
- [ ] T052 [US3] Refresh changed quotes to a new unconfirmed draft revision, preserve invalid lines, and expire stale quotes in `src/lib/commerce/quote.ts` and `src/lib/commerce/confirmation.ts`
- [ ] T053 [US3] Re-resolve and compare all authoritative terms at the database transaction timestamp before accepting a submission in `supabase/migrations/005_b2b_checkout_admin.sql` and `src/lib/commerce/finalization.ts`
- [ ] T054 [US3] Render all safe changes, retain checkout intent, replace the draft revision, and require an accessible second confirmation in `src/components/storefront/quote-change-alert.tsx` and `src/components/storefront/checkout-form.tsx`

**Checkpoint**: US3 passes independently; no included commercial change can silently finalize, even when the final amount is unchanged.

---

## Phase 6: User Story 4 - Create One Durable and Explainable Order (Priority: P1)

**Goal**: Guarantee 24-hour context-bound idempotency, atomic full snapshots, immutable historical meaning, safe provider retries, and no partial Order on failure.

**Independent Test**: Submit the same key concurrently and after a lost response, reuse it with changed intent and another scope, inject each transactional failure, then mutate live Customer/Catalog/Pricing/rule/address data; verify one complete immutable Order and no disclosure or duplicate side effect.

### Tests for User Story 4

- [ ] T055 [P] [US4] Add failing idempotency tests for immediate replay, lost response, changed payload, cross-scope isolation, 24-hour retention/expiry, and two real concurrent database connections in `tests/integration/commerce/idempotency.test.ts`
- [ ] T056 [P] [US4] Add failing transaction and historical tests for line/event/grant failures, quote consumption, full version-1 snapshots, compatibility totals, and later live-data changes in `tests/integration/commerce/finalization.test.ts`
- [ ] T057 [P] [US4] Add failing adapter tests for one post-commit purchase event, provider retry on the same Order, authoritative Kashier amount, and no duplicate notification/analytics effects in `tests/integration/commerce/provider-replay.test.ts`

### Implementation for User Story 4

- [ ] T058 [US4] Implement advisory-lock and unique-index idempotency with scope/payload hashes, non-poisoning validation failures, 24-hour database expiry, and same-Order replay in `supabase/migrations/005_b2b_checkout_admin.sql`
- [ ] T059 [US4] Complete `commerce_finalize_order` so one transaction/time writes Order, Lines, all version-1 snapshots, confirmation grant/customer audit, submission result, quote consumption, and `order.created` or rolls back everything in `supabase/migrations/005_b2b_checkout_admin.sql`
- [ ] T060 [US4] Bind safe created/replayed/conflict/reconfirmation results and stable retry diagnostics in `src/lib/commerce/finalization.ts` and `src/app/api/orders/route.ts`
- [ ] T061 [US4] Generate KeepFit-prefixed numbers for new orders while preserving all historical `XE-*` values and links in `supabase/migrations/005_b2b_checkout_admin.sql` and `src/lib/data/orders.ts`
- [ ] T062 [US4] Read authoritative-v1 and explicit legacy snapshots without live-data recalculation in `src/lib/data/orders.ts`, `src/app/(storefront)/account/orders/page.tsx`, and `src/app/(storefront)/account/orders/[orderNumber]/page.tsx`
- [ ] T063 [US4] Resume COD/Kashier and post-commit notification/Meta/analytics flows from stable committed Order/event identity without replaying purchase effects in `src/lib/kashier.ts`, `src/lib/notifications.ts`, `src/lib/meta-conversions.ts`, and `src/lib/store-analytics.ts`
- [ ] T064 [US4] Reject arbitrary item replacement for snapshot-version Orders while retaining the explicit legacy compatibility path in `src/app/api/admin/orders/[id]/items/route.ts` and `src/components/admin/order-items-editor.tsx`

**Checkpoint**: US4 passes independently under concurrency, injected failure, retry, provider failure, and historical mutation.

---

## Phase 7: User Story 5 - Configure Quantity Rules and Resolve Commerce Blockers (Priority: P2)

**Goal**: Let authorized Admins atomically manage public/type rules and navigate reliable sellability, pricing, and invalid-rule blockers.

**Independent Test**: As Admin, create, replace, deactivate, and review rules across contexts and Units; invalid and concurrent writes fail safely, audit history is complete, fallback is explicit, and each blocker links to its owning management view.

### Tests for User Story 5

- [ ] T065 [P] [US5] Add failing database tests for atomic set/replace/deactivate, one-active invariants, target ownership, invalid values, future types, audit events, and concurrent writers in `tests/integration/commerce/quantity-rule-admin.test.ts`
- [ ] T066 [P] [US5] Add failing Route Handler tests for Admin authorization, schemas, stable errors, bounded query/pagination, and audit correlation IDs in `tests/integration/commerce/quantity-rule-routes.test.ts`
- [ ] T067 [P] [US5] Add failing diagnostic tests for missing sellable Unit, unavailable required price, invalid stored rule, and valid 1/1 fallback in `tests/integration/commerce/commerce-blockers.test.ts`

### Implementation for User Story 5

- [ ] T068 [US5] Implement schema-qualified service-only atomic quantity-rule set/replace/archive commands with advisory locks and append-only audit in `supabase/migrations/005_b2b_checkout_admin.sql`
- [ ] T069 [US5] Implement authorized rule list/mutation services and safe configuration diagnostics in `src/lib/commerce/quantity-rules.ts` and `src/lib/commerce/diagnostics.ts`
- [ ] T070 [US5] Add Admin rule list/set and rule archive endpoints in `src/app/api/admin/commerce/quantity-rules/route.ts` and `src/app/api/admin/commerce/quantity-rules/[ruleId]/route.ts`
- [ ] T071 [US5] Build Product-to-Variant-to-Unit rule management with explicit Public/type context, stored/fallback distinction, validation, audit reason, and replacement feedback in `src/components/admin/quantity-rule-manager.tsx`
- [ ] T072 [US5] Add the protected quantity-rule management page and filtered blocker destinations in `src/app/admin/(protected)/commerce/quantity-rules/page.tsx`
- [ ] T073 [US5] Add Commerce Quantity Rules and Feature 004 Pricing destinations to the existing bilingual protected Admin navigation in `src/components/admin/sidebar.tsx` and `src/lib/i18n/translations.ts`

**Checkpoint**: US5 passes independently; Admin operations are authorized, atomic, audited, data-defined, and linked to owning Catalog/Pricing views.

---

## Phase 8: User Story 6 - Operate Milestone 1 from Admin (Priority: P2)

**Goal**: Provide a coherent live dashboard and server-paginated Order workflow that explains guest and authenticated commercial snapshots without direct database access.

**Independent Test**: Populate approvals, all-age pending-fulfillment Orders, handled Orders, blockers, guest Orders, and B2B Orders; verify exact counts/links, find each Order by business-facing search/filter values, and explain its immutable snapshots.

### Tests for User Story 6

- [ ] T074 [P] [US6] Add failing dashboard tests for exact pending approvals, every `fulfillment_status = 'pending'` Order, reliable blockers, live summary values, and filtered destinations in `tests/integration/commerce/admin-dashboard.test.ts`
- [ ] T075 [P] [US6] Add failing Admin Order tests for cursor pagination, number/name/phone/SKU search, date/status/payment/type filters, guest distinction, persistent Customer link, snapshot detail, and protected-source redaction in `tests/integration/commerce/admin-orders.test.ts`

### Implementation for User Story 6

- [ ] T076 [P] [US6] Implement indexed operational attention, concise summary, and recent-Order queries in `src/lib/data/admin.ts`
- [ ] T077 [P] [US6] Implement indexed cursor-paginated Admin Order list/search/filter and authoritative-v1/legacy detail DTOs in `src/lib/data/orders.ts`
- [ ] T078 [US6] Build “Needs Your Attention” and concise Milestone 1 summary sections with real filtered links in `src/components/admin/operational-attention.tsx` and `src/app/admin/(protected)/page.tsx`
- [ ] T079 [US6] Add the authorized server-paginated Admin Orders endpoint in `src/app/api/admin/orders/route.ts`
- [ ] T080 [US6] Replace newest-100 client filtering with URL-backed server search, filters, pagination, guest/type/status/payment/shipping columns, and loading/empty/error states in `src/components/admin/orders-table.tsx` and `src/app/admin/(protected)/orders/page.tsx`
- [ ] T081 [US6] Render immutable Customer/address, Product/Variant/SKU/Unit, base-equivalent, rule, price-source kind, adjustment, shipping, total, payment, and fulfillment snapshots in `src/components/admin/order-snapshot.tsx` and `src/app/admin/(protected)/orders/[id]/page.tsx`
- [ ] T082 [US6] Add persistent Customer detail navigation for authenticated Orders and explicit guest behavior without phone inference in `src/app/admin/(protected)/customers/[customerId]/page.tsx` and `src/components/admin/order-snapshot.tsx`
- [ ] T083 [US6] Consolidate bilingual accessible existing payment/fulfillment labels without expanding lifecycle semantics in `src/components/admin/status-badge.tsx`, `src/components/admin/orders-table.tsx`, and `src/lib/i18n/translations.ts`

**Checkpoint**: US6 passes independently; an authorized Admin can identify, navigate, find, and explain Milestone 1 work using current data and business-facing values.

---

## Phase 9: Polish & Cross-Cutting Verification

**Purpose**: Prove security, performance, compatibility, external isolation, responsive bilingual UX, deployability, and complete Milestone 1 reconciliation.

- [ ] T084 [P] Add end-to-end tampering and scope tests for price, total, shipping, discount, Customer/type, conversion, rule, address, quote, submission, and Order ownership in `tests/integration/commerce/security-tampering.test.ts`
- [ ] T085 [P] Add 25-line and 100-line query-count/performance coverage and assert the hard line limit without shared personalized caching in `tests/integration/commerce/performance.test.ts`
- [ ] T086 [P] Add one Milestone 1 guest, Retail, approved Wholesale, and Gym journey plus Feature 001-004 regression reconciliation in `tests/integration/commerce/milestone-1.test.ts`
- [ ] T087 [P] Extend provider isolation regression to prove no live charge, shipment, pickup, notification, Telegram, Meta, or analytics call and no pre-commit/replay purchase event in `tests/integration/customer-account/provider-snapshot-regression.test.ts`
- [ ] T088 [P] Add responsive RTL/LTR component coverage for Product, cart, checkout, change alerts, quantity rules, dashboard, Orders, and detail at approximately 390 px in `tests/integration/commerce/mobile-bilingual-ui.test.tsx`
- [ ] T089 Verify service-role-only execute, empty search paths, direct table revokes, scoped 404 behavior, guest hash storage, cookie flags, bounded inputs, and redacted diagnostics in `tests/integration/commerce/migration-rls.test.ts` and `tests/integration/commerce/security-tampering.test.ts`
- [ ] T090 Rehearse no-write preflight failure, convergent migration, legacy parity, post-schema rollback, post-cutover compatibility rollback, and backup restore; record evidence in `specs/005-b2b-checkout-admin/quickstart.md`
- [ ] T091 Run separate Kashier, Bosta, Mylerz, notification/Telegram, Meta, and analytics sandbox checks and record results without converting pending checks into automated passes in `specs/005-b2b-checkout-admin/quickstart.md`
- [ ] T092 Complete manual Arabic RTL and English LTR 390 px acceptance, keyboard/focus/touch review, and under-three-minute checkout/admin usability checks in `specs/005-b2b-checkout-admin/quickstart.md`
- [ ] T093 Reconcile every agreed Milestone 1 requirement as implemented, existing-and-verified, or deferred to a named Feature and publish the four-section closure evidence in `specs/005-b2b-checkout-admin/checklists/milestone-1-closure.md`
- [ ] T094 Run `npm test -- tests/unit/commerce tests/integration/commerce`, `npm run test:customer-db`, `npm run lint`, and `npm run build`, then record the final automated result in `specs/005-b2b-checkout-admin/checklists/milestone-1-closure.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Starts immediately.
- **Phase 2 (Foundational prerequisite convergence)**: Depends on Phase 1 and blocks every user story. T004-T013 must pass before T014-T019 may apply Feature 005 database changes.
- **Phase 3 (US1)**: Depends on Phase 2 and delivers the smallest end-to-end commerce slice.
- **Phase 4 (US2)**: Depends on Phase 2; it can proceed alongside US1 after the shared resolver foundations exist, then integrates with the same Product/cart/quote flow.
- **Phase 5 (US3)**: Depends on US1’s persisted quote, confirmation, and base finalization path.
- **Phase 6 (US4)**: Depends on US1 and US3 so idempotent finalization hardens the completed confirmation/change boundary.
- **Phase 7 (US5)**: Depends on Phase 2 and the shared quantity resolver; it can proceed alongside US1-US4 in separate Admin/database files, except SQL tasks that modify `005_b2b_checkout_admin.sql` must be serialized.
- **Phase 8 (US6)**: Depends on US4’s authoritative snapshots for full detail and on US5 diagnostics for blocker cards.
- **Phase 9 (Polish)**: Depends on all stories selected for release.

### User Story Dependency Graph

```text
Phase 1 Setup
      │
      ▼
Phase 2 Feature 003/004 convergence + Feature 005 foundation
      ├──────────────► US1 authoritative guest/Retail order ──► US3 reconfirmation ──► US4 durable order
      ├──────────────► US2 B2B prices/rules ──────────────────────────────────────────┤
      └──────────────► US5 Admin quantity/blockers ───────────────────────────────────┴──► US6 operations
                                                                                           │
                                                                                           ▼
                                                                                  Cross-cutting closure
```

### Within Each User Story

- Write the listed tests first and confirm they fail for the intended missing behavior.
- Establish data/service invariants before Route Handlers.
- Complete Route Handlers/services before their UI consumers.
- Keep browser state intent-only and revalidate through the server/database boundary.
- Pass the story’s independent test before starting a dependent story.
- Serialize tasks that edit the shared `supabase/migrations/005_b2b_checkout_admin.sql`; parallel markers never override that file-level constraint.

## Parallel Execution Examples

### User Story 1

- Run T023, T024, and T025 together to establish HTTP, end-to-end, and provider expectations.
- After T033, T034 can proceed in parallel with the server quote/checkout UI work because it changes Product purchase files.

### User Story 2

- Run T039, T040, and T041 together before implementing the resolver and cart migration.
- T046 fixture work can proceed beside T043-T045 once the prerequisite schema is stable.

### User Story 3

- Run T047, T048, and T049 together.
- After T050-T053 define the server behavior, T054 is isolated to storefront UI files.

### User Story 4

- Run T055, T056, and T057 together.
- After T059, T062 and T063 can proceed in parallel in read-model and provider files.

### User Story 5

- Run T065, T066, and T067 together.
- After T068-T070, T071 and T073 can proceed in parallel before T072 assembles the page.

### User Story 6

- Run T074 and T075 together.
- Run T076 and T077 together, then build dashboard and Order UI work in parallel where their files do not overlap.

## Implementation Strategy

### MVP First

1. Complete Phase 1.
2. Complete and prove the Phase 2 prerequisite gate; stop with zero Feature 005 writes if it fails.
3. Complete US1 with default 1/1 quantity behavior.
4. Run US1’s independent guest and Retail tests before demo or deployment.

### Incremental Delivery

1. Add US2 to enable approved B2B pricing/rules and packaging-unit correctness.
2. Add US3 so any confirmed commercial change requires safe review.
3. Add US4 to close concurrency, retry, atomicity, snapshots, and provider replay guarantees.
4. Add US5 so operations can configure rules and resolve blockers without direct data access.
5. Add US6 so the complete Milestone 1 workflow is operable from Admin.
6. Complete Phase 9; automated success alone does not constitute production acceptance.

## Notes

- Feature 003 and Feature 004 prerequisite tasks remain owned by Catalog and Pricing even though this execution order must complete them first.
- Never create a temporary Commerce Sellable Unit or Pricing authority.
- Do not apply production quantity fixtures by default; T046 data must be clearly marked and removable.
- Preserve existing user changes outside the files named by a task.
- Keep advanced lifecycle, inventory/reservations, post-order editing/repricing, reporting, automation, and full audit administration out of Feature 005.
