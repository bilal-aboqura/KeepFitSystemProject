# Tasks: Authoritative Pricing Engine

**Input**: Design documents from `F:\CodingProjects\KeepFit\specs\004-pricing-engine\`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts\pricing-api.md`, `quickstart.md`

**Tests**: Required. Pricing, checkout authority, transactional integrity, authorization, RLS, and immutable order snapshots are constitution-priority business rules.

**Organization**: Tasks are grouped by user story so each story remains independently testable after the shared data/resolver foundation is complete.

## Phase 1: Setup and prerequisite verification

**Purpose**: Confirm the Feature 003 commercial-unit dependency and establish the Feature 004 migration/test surfaces before changing commerce behavior.

- [ ] T001 Add the Feature 004 migration runner script entry and non-production fixture entry points in `F:\CodingProjects\KeepFit\package.json`
- [ ] T002 [P] Create Feature 004 migration and fixture runner scaffolds in `F:\CodingProjects\KeepFit\scripts\migrate-feature-004.mjs` and `F:\CodingProjects\KeepFit\scripts\seed-feature-004-pricing.mjs`
- [ ] T003 [P] Create pricing test fixture helpers for lists, periods, effective Customer Types, and Variant/Sellable Unit targets in `F:\CodingProjects\KeepFit\tests\helpers\pricing-fixtures.ts`
- [ ] T004 [P] Create server-only pricing test bootstrap helpers in `F:\CodingProjects\KeepFit\tests\helpers\pricing-test-db.ts`
- [ ] T005 Verify the deployed Feature 003 Variant, Sellable Unit, conversion, cart, and order-line schema against `F:\CodingProjects\KeepFit\specs\003-catalog-variants-media\data-model.md` and record the resolved physical table/column names in `F:\CodingProjects\KeepFit\specs\004-pricing-engine\data-model.md`
- [ ] T006 Stop implementation and reconcile Feature 003 first if the prerequisite structures verified in `F:\CodingProjects\KeepFit\scripts\migrate-feature-004.mjs` are absent or unpopulated

---

## Phase 2: Foundational pricing data and domain boundaries

**Purpose**: Create the shared, server-authoritative pricing foundation that blocks every user story.

**⚠️ CRITICAL**: Complete this phase before work in any user-story phase.

- [ ] T007 Define Feature 004 monetary, resolution, source, availability, command, and diagnostic TypeScript types in `F:\CodingProjects\KeepFit\src\lib\pricing\types.ts`
- [ ] T008 [P] Write migration/RLS invariant tests for default uniqueness, period overlap, grants, and Customer mutation denial in `F:\CodingProjects\KeepFit\tests\integration\pricing\pricing-migration-rls.test.ts`
- [ ] T009 [P] Write fixed-point conversion and half-up rounding tests for 100/3, 100/6, line totals, and serialization in `F:\CodingProjects\KeepFit\tests\unit\pricing\money.test.ts`
- [ ] T010 [P] Write validation tests for price amount, EGP currency, target IDs, and half-open interval input in `F:\CodingProjects\KeepFit\tests\unit\pricing\validation.test.ts`
- [ ] T011 Create the Feature 004 additive pricing schema, `btree_gist` extension, effective-range checks, GiST exclusion constraints, indexes, RLS, grants, private RPC privileges, and convergent schema changes in `F:\CodingProjects\KeepFit\supabase\migrations\004_pricing_engine.sql` and `F:\CodingProjects\KeepFit\supabase\schema.sql`
- [ ] T012 Implement migration preflight/reporting for legacy Variant base-price precision, default-unit coverage, duplicate targets, and packaging conversion integrity in `F:\CodingProjects\KeepFit\scripts\migrate-feature-004.mjs`
- [ ] T013 Implement bounded-piastre parsing, exact rational conversion, one-time half-up rounding, line-total calculation, and display serialization in `F:\CodingProjects\KeepFit\src\lib\pricing\money.ts`
- [ ] T014 Implement server-compatible Zod schemas for price Lists, entries, intervals, mappings, direct assignments, overrides, reprice input, and diagnostics input in `F:\CodingProjects\KeepFit\src\lib\pricing\validation.ts`
- [ ] T015 Establish one non-conflicting canonical pricing import boundary by moving or adapting legacy subtotal/card-discount helpers from `F:\CodingProjects\KeepFit\src\lib\pricing.ts` into `F:\CodingProjects\KeepFit\src\lib\pricing\legacy-adjustments.ts` and updating its imports in `F:\CodingProjects\KeepFit\src\lib\data\orders.ts` and `F:\CodingProjects\KeepFit\src\app\api\admin\orders\[id]\items\route.ts`
- [ ] T016 Implement server-only pricing configuration, active Candidate, and effective Customer-Type query functions in `F:\CodingProjects\KeepFit\src\lib\pricing\queries.ts` and `F:\CodingProjects\KeepFit\src\lib\pricing\context.ts`
- [ ] T017 Implement the Catalog seam that validates Variant/Unit ownership, active sellability, labels/SKU, base-unit equivalent, and parent conversion graph in `F:\CodingProjects\KeepFit\src\lib\pricing\catalog-targets.ts`
- [ ] T018 Implement append-only pricing audit event persistence and stable pricing event names in `F:\CodingProjects\KeepFit\src\lib\pricing\audit.ts`
- [ ] T019 Implement security-definer admin transaction wrappers with empty search path, actor validation, default locking, audit correlation IDs, and service-role-only execution in `F:\CodingProjects\KeepFit\supabase\migrations\004_pricing_engine.sql`

**Checkpoint**: The database can represent safe price configuration and the domain has safe money, validation, Customer context, Catalog seam, and audit primitives.

---

## Phase 3: User Story 1 — Receive the correct authoritative Variant price (Priority: P1) 🎯 MVP

**Goal**: Guests and Customers receive the correct current Variant + Sellable Unit price without client-controlled context, including scheduled and derived pricing.

**Independent Test**: Configure default/Retail/Wholesale/Gym Lists for a target; verify guest, approved Customer, and pending-Wholesale Customer results, then verify server cart reprice returns a current changed price.

### Tests for User Story 1

- [ ] T020 [P] [US1] Write resolver priority and fallback tests for guest/default, Type mapping, pending approval, direct List, override, inactive, expired, and unavailable paths in `F:\CodingProjects\KeepFit\tests\unit\pricing\resolver-priority.test.ts`
- [ ] T021 [P] [US1] Write explicit/derived packaging tests for Box→Ampoule, Box→Strip→Tablet, nearest ancestor, type-specific source, override source, and invalid conversion graph in `F:\CodingProjects\KeepFit\tests\unit\pricing\packaging-derivation.test.ts`
- [ ] T022 [P] [US1] Write scheduled-price boundary and batch de-duplication/query-count tests in `F:\CodingProjects\KeepFit\tests\integration\pricing\resolver-scheduling-batch.test.ts`
- [ ] T023 [P] [US1] Write public reprice endpoint tests proving client Customer/type/List/timestamp inputs cannot alter the resolved price in `F:\CodingProjects\KeepFit\tests\integration\pricing\reprice-api.test.ts`

### Implementation for User Story 1

- [ ] T024 [US1] Implement same-source explicit target selection and nearest-parent packaging derivation in `F:\CodingProjects\KeepFit\src\lib\pricing\packaging.ts`
- [ ] T025 [US1] Implement the single and batched resolver with override → direct List → effective Type List → default → unavailable precedence in `F:\CodingProjects\KeepFit\src\lib\pricing\resolver.ts`
- [ ] T026 [US1] Implement safe public DTO projection that removes alternate tiers, trace details, and protected identifiers in `F:\CodingProjects\KeepFit\src\lib\pricing\public-projection.ts`
- [ ] T027 [US1] Implement session-derived guest/current-Customer cart repricing endpoint with only Variant/Unit/quantity input in `F:\CodingProjects\KeepFit\src\app\api\pricing\reprice\route.ts`
- [ ] T028 [US1] Extend current catalog read models to batch-resolve safe current-context Variant/Unit price projections in `F:\CodingProjects\KeepFit\src\lib\data\catalog.ts`
- [ ] T029 [US1] Update Product-card price representation for multi-Variant/unit `From` pricing and unavailable state in `F:\CodingProjects\KeepFit\src\components\storefront\product-card.tsx`
- [ ] T030 [US1] Update selected Variant/Sellable Unit pricing and reprice-state handling in `F:\CodingProjects\KeepFit\src\components\storefront\product-purchase-box.tsx`
- [ ] T031 [US1] Update cart state to persist Variant/Unit identity plus disposable pricing display snapshot and apply server reprice responses in `F:\CodingProjects\KeepFit\src\lib\cart.ts` and `F:\CodingProjects\KeepFit\src\app\(storefront)\cart\page.tsx`
- [ ] T032 [US1] Add Arabic/English translations for derived price, unavailable, price changed, and reprice retry states in `F:\CodingProjects\KeepFit\src\lib\i18n\translations.ts`

**Checkpoint**: A guest or current Customer can independently receive one safe authoritative price or unavailable outcome across listing, selected product, and cart reprice.

---

## Phase 4: User Story 2 — Complete checkout with server-authoritative totals (Priority: P1)

**Goal**: Checkout accepts canonical commercial identities, recalculates all monetary values on the server, and preserves immutable snapshots.

**Independent Test**: Send a valid Variant/Unit order with a forged low price and verify persisted unit/line/order totals use the resolver; change configuration afterward and verify the historical order remains unchanged.

### Tests for User Story 2

- [ ] T033 [P] [US2] Write order-route contract tests for Variant/Unit-only input, rejected legacy monetary authority, `PRICE_CHANGED`, and `PRICE_UNAVAILABLE` in `F:\CodingProjects\KeepFit\tests\integration\pricing\order-pricing-api.test.ts`
- [ ] T034 [P] [US2] Write transaction tests for multi-line authoritative totals, no partial order, snapshot completeness, and historical immutability in `F:\CodingProjects\KeepFit\tests\integration\pricing\order-snapshots.test.ts`
- [ ] T035 [P] [US2] Write regression tests for existing shipping, coupon/card-discount, COD, Kashier amount, and confirmation-grant behavior after reprice in `F:\CodingProjects\KeepFit\tests\integration\pricing\checkout-adjustments-regression.test.ts`

### Implementation for User Story 2

- [ ] T036 [US2] Add additive Variant/Unit/SKU/label/base-equivalent/unit/line/source snapshot columns and new-row integrity checks to `F:\CodingProjects\KeepFit\supabase\migrations\004_pricing_engine.sql` and `F:\CodingProjects\KeepFit\supabase\schema.sql`
- [ ] T037 [US2] Replace client-priced order input with Variant/Unit/quantity command validation and retry-safe pricing error mapping in `F:\CodingProjects\KeepFit\src\app\api\orders\route.ts`
- [ ] T038 [US2] Implement transactional authoritative order assembly that derives Customer context, batch-resolves targets, calculates monetary totals, applies existing supported adjustments after unit pricing, and persists snapshots in `F:\CodingProjects\KeepFit\src\lib\data\orders.ts`
- [ ] T039 [US2] Update checkout request construction to send only canonical Variant/Unit/quantity items and handle reprice/unavailable confirmation states in `F:\CodingProjects\KeepFit\src\app\(storefront)\checkout\page.tsx`
- [ ] T040 [US2] Update Customer order-history and secure order-detail projections to prefer immutable Variant/Unit pricing snapshots while preserving legacy rows in `F:\CodingProjects\KeepFit\src\lib\customers\queries.ts` and `F:\CodingProjects\KeepFit\src\app\(storefront)\account\orders\[orderNumber]\page.tsx`
- [ ] T041 [US2] Update admin order detail/item editing and downstream snapshot consumers to avoid live price resolution in `F:\CodingProjects\KeepFit\src\app\api\admin\orders\[id]\items\route.ts`, `F:\CodingProjects\KeepFit\src\components\admin\order-items-editor.tsx`, `F:\CodingProjects\KeepFit\src\lib\notifications.ts`, and `F:\CodingProjects\KeepFit\src\lib\meta-conversions.ts`

**Checkpoint**: Checkout is independently safe against browser price manipulation and new orders preserve immutable pricing facts.

---

## Phase 5: User Story 3 — Manage Price Lists and customer price rules (Priority: P2)

**Goal**: Authorized administrators can maintain Lists, explicit/scheduled prices, mappings, direct assignments, and overrides without code changes or partial configuration.

**Independent Test**: Create active Wholesale List and Unit price, map Wholesale, set a direct List and Customer override, then verify precedence, interval behavior, inactive fallback, default safety, and audit records.

### Tests for User Story 3

- [ ] T042 [P] [US3] Write admin command tests for Price List create/edit/archive, singleton default replacement, mapping, and inactive-reference rejection in `F:\CodingProjects\KeepFit\tests\integration\pricing\admin-price-lists.test.ts`
- [ ] T043 [P] [US3] Write bulk-grid and schedule transaction tests for all-or-nothing save, close-prior-at-start, overlap rejection, and audit correlation in `F:\CodingProjects\KeepFit\tests\integration\pricing\admin-price-entry-commands.test.ts`
- [ ] T044 [P] [US3] Write direct Customer List and Customer Unit override command tests for assignment/removal, expiry, precedence, and archive history in `F:\CodingProjects\KeepFit\tests\integration\pricing\customer-price-rules.test.ts`

### Implementation for User Story 3

- [ ] T045 [US3] Implement admin Price List, default configuration, mapping, direct assignment, and override transactional commands in `F:\CodingProjects\KeepFit\src\lib\pricing\commands.ts`
- [ ] T046 [US3] Implement atomic List CRUD/default endpoints guarded by `requireAdminUser` in `F:\CodingProjects\KeepFit\src\app\api\admin\pricing\lists\route.ts`, `F:\CodingProjects\KeepFit\src\app\api\admin\pricing\lists\[id]\route.ts`, and `F:\CodingProjects\KeepFit\src\app\api\admin\pricing\default\route.ts`
- [ ] T047 [US3] Implement filtered price-grid, bulk-save, and scheduled replacement endpoints guarded by `requireAdminUser` in `F:\CodingProjects\KeepFit\src\app\api\admin\pricing\lists\[id]\items\route.ts` and `F:\CodingProjects\KeepFit\src\app\api\admin\pricing\lists\[id]\items\schedule\route.ts`
- [ ] T048 [US3] Implement Customer Type mapping endpoints guarded by `requireAdminUser` in `F:\CodingProjects\KeepFit\src\app\api\admin\pricing\customer-type-mappings\route.ts`
- [ ] T049 [US3] Implement direct Customer List and Customer Variant/Unit override endpoints guarded by `requireAdminUser` in `F:\CodingProjects\KeepFit\src\app\api\admin\customers\[customerId]\price-list\route.ts` and `F:\CodingProjects\KeepFit\src\app\api\admin\customers\[customerId]\price-overrides\route.ts`
- [ ] T050 [US3] Build localized Price List list/detail and operational price-grid/schedule UI in `F:\CodingProjects\KeepFit\src\app\admin\(protected)\pricing\page.tsx`, `F:\CodingProjects\KeepFit\src\app\admin\(protected)\pricing\lists\[id]\page.tsx`, `F:\CodingProjects\KeepFit\src\components\admin\price-list-manager.tsx`, and `F:\CodingProjects\KeepFit\src\components\admin\price-grid.tsx`
- [ ] T051 [US3] Extend the existing admin Customer view with direct List assignment and Customer Variant/Unit override controls in `F:\CodingProjects\KeepFit\src\app\admin\(protected)\customers\page.tsx`, `F:\CodingProjects\KeepFit\src\components\admin\customer-price-rules.tsx`, and `F:\CodingProjects\KeepFit\src\components\admin\sidebar.tsx`
- [ ] T052 [US3] Add Arabic/English admin labels and validation/error text for Lists, schedules, mappings, direct assignments, overrides, explicit/derived indicators, and bulk-save errors in `F:\CodingProjects\KeepFit\src\lib\i18n\translations.ts`

**Checkpoint**: An authorized admin can independently configure the complete pricing hierarchy and schedule prices without creating overlapping/partial state.

---

## Phase 6: User Story 4 — Diagnose and protect pricing operations (Priority: P2)

**Goal**: Admins can explain a real resolver decision and audit changes, while ordinary customers cannot mutate or discover protected pricing.

**Independent Test**: Preview an overridden Wholesale target as an admin and verify the trace; attempt protected reads/mutations as Retail/another Customer and verify denial with no tier leakage.

### Tests for User Story 4

- [ ] T053 [P] [US4] Write admin diagnostic tests for explicit/derived source trace, trusted timestamp, and no configuration mutation in `F:\CodingProjects\KeepFit\tests\integration\pricing\pricing-diagnostics.test.ts`
- [ ] T054 [P] [US4] Write RLS/API negative tests for protected List/override/trace isolation, Customer A/B denial, fake context, and admin authorization in `F:\CodingProjects\KeepFit\tests\integration\security\pricing-access-control.test.ts`
- [ ] T055 [P] [US4] Write audit-history tests for List, default, mapping, direct assignment, override, scheduled/bulk price changes, actor, old/new redaction, and correlation ID in `F:\CodingProjects\KeepFit\tests\integration\pricing\pricing-audit.test.ts`

### Implementation for User Story 4

- [ ] T056 [US4] Implement trusted resolver trace assembly without alternate public projection in `F:\CodingProjects\KeepFit\src\lib\pricing\diagnostics.ts`
- [ ] T057 [US4] Implement read-only admin diagnostic endpoint guarded by `requireAdminUser` in `F:\CodingProjects\KeepFit\src\app\api\admin\pricing\diagnostics\resolve\route.ts`
- [ ] T058 [US4] Implement pricing audit query/read model restricted to authorized operations in `F:\CodingProjects\KeepFit\src\lib\pricing\audit-queries.ts`
- [ ] T059 [US4] Build localized admin diagnostic and audit-history UI in `F:\CodingProjects\KeepFit\src\app\admin\(protected)\pricing\diagnostics\page.tsx`, `F:\CodingProjects\KeepFit\src\components\admin\pricing-diagnostic.tsx`, and `F:\CodingProjects\KeepFit\src\components\admin\pricing-audit-history.tsx`
- [ ] T060 [US4] Add structured redacted logging for no-price, invalid conversion, interval conflict, and checkout reprice exceptions in `F:\CodingProjects\KeepFit\src\lib\pricing\observability.ts` and `F:\CodingProjects\KeepFit\src\app\api\orders\route.ts`

**Checkpoint**: Only admins can inspect pricing reason/source and audit data; normal Customers can obtain only their own safe resolved price.

---

## Phase 7: Polish, migration activation, and cross-cutting regression

**Purpose**: Prove safe cutover, performance, localization, integrations, and Feature 005 readiness.

- [ ] T061 [P] Add development/staging-only Retail/Wholesale/Gym explicit/derived/direct/override/fallback/schedule fixtures to `F:\CodingProjects\KeepFit\scripts\seed-feature-004-pricing.mjs`
- [ ] T062 [P] Add migration parity and rollback-rehearsal tests comparing legacy default price with migrated default-List price in `F:\CodingProjects\KeepFit\tests\integration\pricing\pricing-cutover.test.ts`
- [ ] T063 [P] Add resolver performance/query-count and cache-safety tests for grids/carts with mixed Customers in `F:\CodingProjects\KeepFit\tests\integration\pricing\pricing-performance-security.test.ts`
- [ ] T064 [P] Add Feature 001–003 plus COD/Kashier/Bosta/Mylerz/notification/Meta/analytics regression coverage for snapshot-based pricing in `F:\CodingProjects\KeepFit\tests\integration\pricing\pricing-regression.test.ts`
- [ ] T065 Add no-store/global-personalized-cache safeguards and scheduled-activation behavior documentation in `F:\CodingProjects\KeepFit\src\lib\pricing\resolver.ts` and `F:\CodingProjects\KeepFit\specs\004-pricing-engine\quickstart.md`
- [ ] T066 Perform Arabic RTL/English LTR ~390 px visual acceptance for card, selected-unit, cart, checkout, price-grid, schedule, diagnostic, and unavailable states and record results in `F:\CodingProjects\KeepFit\specs\004-pricing-engine\quickstart.md`
- [ ] T067 Run targeted pricing suites and project checks, recording outcomes in `F:\CodingProjects\KeepFit\specs\004-pricing-engine\quickstart.md` with `npm test`, `npm run lint`, and `npm run build`
- [ ] T068 Verify Feature 005 can consume only the resolver's Customer/Variant/Sellable Unit result and document the no-MOQ/no-inventory boundary in `F:\CodingProjects\KeepFit\src\lib\pricing\types.ts` and `F:\CodingProjects\KeepFit\specs\004-pricing-engine\plan.md`

---

## Dependencies and execution order

### Phase dependencies

- **Phase 1**: Starts immediately; T005/T006 are an explicit Feature 003 deployment gate.
- **Phase 2**: Depends on Phase 1 and blocks all stories. T011 and T019 establish the authoritative data/transaction boundary; T013–T018 create the shared domain primitives.
- **US1 (Phase 3)**: Depends on Phase 2; delivers the MVP resolver/read/reprice path.
- **US2 (Phase 4)**: Depends on Phase 2 and the US1 resolver; must follow US1 before checkout cutover.
- **US3 (Phase 5)**: Depends on Phase 2; can be developed alongside US1 by a separate developer, but its configured data is needed for full US1 acceptance.
- **US4 (Phase 6)**: Depends on Phase 2 and uses the resolver/audit from US1/US3.
- **Phase 7**: Depends on all selected stories and performs cutover/regression proof.

### User-story dependency graph

```text
Phase 1 → Phase 2 ──→ US1 ──→ US2
                  ├──→ US3 ──→ US4
                  └────────────────→ Phase 7
```

### Parallel opportunities

- T002–T004 and T008–T010 can proceed in parallel.
- Within US1, T020–T023 can run in parallel before T024–T032.
- Within US2, T033–T035 can run in parallel before T036–T041.
- Within US3, T042–T044 can run in parallel before T045–T052.
- Within US4, T053–T055 can run in parallel before T056–T060.
- T061–T064 may run in parallel once their dependent stories are complete.

## Implementation strategy

### MVP first

1. Complete Phase 1, including the hard Feature 003 prerequisite check.
2. Complete Phase 2.
3. Complete US1 and independently verify public/default/type/derived/reprice behavior.
4. Do not make checkout authoritative until US2's spoofing and snapshot tests pass.

### Incremental delivery

1. Deliver resolver/read/reprice (US1) behind the validated default-list migration.
2. Deliver transactional checkout/snapshots (US2) and remove browser monetary authority.
3. Deliver admin configuration (US3), then diagnostics/audit protection (US4).
4. Run staged parity, rollback, external-adapter, and mobile regression before production cutover.

## Format validation

All 68 tasks use the required checkbox, sequential ID, optional parallel marker, required user-story marker for story work, and one or more exact repository paths.
