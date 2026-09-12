# Tasks: Customer Types & Approval

**Input**: Design documents from `/specs/002-customer-type-approval/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [customer-type-api.md](./contracts/customer-type-api.md), [quickstart.md](./quickstart.md)

**Tests**: Targeted automated tests are required because this feature changes customer authorization, approval lifecycle, transactional commercial classification, and audit controls.

**Organization**: Tasks are grouped by user story so each journey can be built and validated as an independently useful increment after the shared foundation is complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the Feature 002 migration/test entry points without changing application behavior.

- [X] T001 Add the Feature 002 migration script entry to `package.json` and create `scripts/migrate-feature-002.mjs` following the Feature 001 `DIRECT_URL` transaction-runner convention.
- [X] T002 [P] Add Customer Type fixtures and server-only test mocks in `tests/helpers/customer-type-fixtures.ts` and `tests/helpers/server-only.ts`.
- [X] T003 [P] Create customer-type test suites in `tests/unit/customers/customer-types.test.ts` and `tests/integration/customer-type-approval.test.ts` with the plan’s migration, ownership, transition, and privacy scenarios.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the durable model, authoritative transaction boundaries, authorization protections, and shared Customer-domain interfaces required by every journey.

**⚠️ CRITICAL**: Complete this phase before beginning customer or admin UI work.

- [X] T004 Create `supabase/migrations/002_customer_type_approval.sql` with `customer_types`, `customer_type_requests`, and `customer_type_audit_events`; add `customers.customer_type_id`; seed active `retail`, `wholesale`, and `gym_owner`; backfill every existing Customer to Retail before enforcing the effective-type invariant.
- [X] T005 Extend convergent schema definitions and RLS/grants in `supabase/schema.sql` to match `supabase/migrations/002_customer_type_approval.sql`, including public read of active type display data and no browser-role mutation of effective types, decision fields, or audit records.
- [X] T006 Add database indexes and invariants in `supabase/migrations/002_customer_type_approval.sql`: unique type codes, active-type lookup, request/history indexes, and a partial unique index allowing at most one `pending` request per Customer.
- [X] T007 Implement guarded transactional database commands in `supabase/migrations/002_customer_type_approval.sql` for request creation, approve, reject, and direct assignment, including conditional pending-state checks, audit rows, and pending-request supersession during direct assignment; revoke browser execution and grant only server authority.
- [X] T008 [P] Extend Customer domain interfaces and request/audit projections in `src/lib/customers/types.ts` with stable type codes, final request states, public/admin projections, and typed transition outcomes.
- [X] T009 [P] Add strict shared request/decision schemas and bounded optional business fields in `src/lib/customers/validation.ts`, reusing Egyptian phone normalization and prohibiting client status/effective-type/actor fields.
- [X] T010 Implement server-only Customer Type catalog/effective-type/read-history queries in `src/lib/customers/customer-types.ts` and `src/lib/customers/type-requests.ts`, using `customers.customer_type_id` as the sole current authority.
- [X] T011 Implement server-only approval, rejection, and direct-assignment wrappers in `src/lib/customers/type-approval.ts`; map database transition failures to typed unauthorized/not-found/validation/conflict outcomes without leaking raw errors.
- [X] T012 Add foundation tests in `tests/unit/customers/customer-types.test.ts` and `tests/integration/customer-type-approval.test.ts` for Retail migration/default, stable-code behavior, inactive type rejection, one-pending invariant, direct-write/RLS denial, and shared business-phone allowance.

**Checkpoint**: The database has a complete source of truth; server commands enforce authorization, idempotency, auditability, and transaction integrity. User stories can begin.

---

## Phase 3: User Story 1 - Request a commercial account (Priority: P1) 🎯 MVP

**Goal**: An authenticated Retail or protected-type customer can see the effective type and submit one eligible protected commercial request while remaining able to shop as their current effective type.

**Independent Test**: Sign in as a Retail Customer, submit a valid Wholesale Trader request, verify one safe pending record/history projection and unchanged effective Retail type, then repeat the flow for Gym Owner after resolution.

### Tests for User Story 1

- [X] T013 [P] [US1] Add customer request validation and eligibility tests in `tests/unit/customers/customer-types.test.ts` for Retail exclusion, active/protected codes, current-type conflict, and type-specific business labels.
- [X] T014 [P] [US1] Add customer request route/integration tests in `tests/integration/customer-type-approval.test.ts` for session-derived ownership, duplicate/retry conflict, cross-customer denial, and unchanged effective type.

### Implementation for User Story 1

- [X] T015 [US1] Implement canonical-Customer request creation and customer-safe type-state/history projections in `src/lib/customers/type-requests.ts` using the guarded database command from T007.
- [X] T016 [US1] Add `GET /api/customer/type-state`, `POST /api/customer/type-requests`, and `GET /api/customer/type-requests/history` handlers in `src/app/api/customer/type-state/route.ts`, `src/app/api/customer/type-requests/route.ts`, and `src/app/api/customer/type-requests/history/route.ts`.
- [X] T017 [P] [US1] Add Arabic/English Customer Type labels, request states, eligibility errors, and form copy in `src/lib/i18n/translations.ts` using stable codes rather than translated rule inputs.
- [X] T018 [US1] Create a mobile-first localized request form/status component in `src/components/storefront/customer-type-request.tsx` with Retail/no-request, pending, validation, loading, and error states.
- [X] T019 [US1] Integrate the Account Type section and request flow into `src/app/(storefront)/account/page.tsx` (and `src/app/(storefront)/account/layout.tsx` only if a focused account route is needed) without redesigning existing account navigation.
- [X] T020 [US1] Verify the US1 checkpoint with `tests/unit/customers/customer-types.test.ts`, `tests/integration/customer-type-approval.test.ts`, and the account flow at Arabic/English 390 px widths; confirm no cart, checkout, or price path changes in `src/app/(storefront)/checkout/page.tsx` and `src/lib/pricing.ts`.

**Checkpoint**: Customers can request a protected type and see a safe pending state; effective type and all existing commerce behavior remain unchanged.

---

## Phase 4: User Story 2 - Review and decide commercial requests (Priority: P1)

**Goal**: Authorized administrators can find a pending request, inspect relevant details, and approve or reject it exactly once; approval atomically changes the effective type and rejection does not.

**Independent Test**: Submit a pending request, approve it as an admin, verify the request/type/audit result; submit another request and reject it, confirming the type does not change and private notes stay private.

### Tests for User Story 2

- [X] T021 [P] [US2] Add approval/rejection transition tests in `tests/integration/customer-type-approval.test.ts` for atomic approval, unchanged effective type after rejection, stale/repeated decision conflict, and final-state immutability.
- [X] T022 [P] [US2] Add admin route/authorization/privacy tests in `tests/integration/customer-type-approval.test.ts` for `requireAdmin`, unauthorized refusal, customer denial, request-detail ownership boundaries, and internal-note omission from customer projections.

### Implementation for User Story 2

- [X] T023 [US2] Complete approved/rejected decision orchestration and admin detail/queue projections in `src/lib/customers/type-approval.ts` and `src/lib/customers/type-requests.ts`, preserving public and internal rejection fields separately.
- [X] T024 [US2] Add guarded admin queue/detail/approve/reject handlers in `src/app/api/admin/customer-type-requests/route.ts`, `src/app/api/admin/customer-type-requests/[requestId]/route.ts`, `src/app/api/admin/customer-type-requests/[requestId]/approve/route.ts`, and `src/app/api/admin/customer-type-requests/[requestId]/reject/route.ts`.
- [X] T025 [P] [US2] Add Admin request queue and detail components with explicit approve/reject confirmation, reason/internal-note fields, loading/error/conflict feedback, and localized labels in `src/components/admin/customer-type-request-queue.tsx` and `src/components/admin/customer-type-request-detail.tsx`.
- [X] T026 [US2] Add protected queue and detail pages in `src/app/admin/(protected)/customer-type-requests/page.tsx` and `src/app/admin/(protected)/customer-type-requests/[requestId]/page.tsx`, defaulting the queue to Pending.
- [X] T027 [US2] Add the Customer Type Requests navigation item and matching Arabic/English labels in `src/components/admin/sidebar.tsx` and `src/lib/i18n/translations.ts`.
- [X] T028 [US2] Verify the US2 checkpoint with pending-to-approved, pending-to-rejected, stale second-decision, and unauthorized-decision journeys in `tests/integration/customer-type-approval.test.ts`.

**Checkpoint**: Admin decisions are explicit, authorized, auditable, and concurrency-safe; the customer sees only allowed decision information.

---

## Phase 5: User Story 3 - Understand status and reapply (Priority: P2)

**Goal**: Customers can understand effective type, pending/approved/rejected outcome, public rejection reason, and preserved history; rejected customers can legitimately reapply.

**Independent Test**: Reject a request with separate public/internal notes, view it as the Customer, confirm only the public reason appears, submit a new valid request, and confirm both records remain intact.

### Tests for User Story 3

- [X] T029 [P] [US3] Add customer-history/reapplication tests in `tests/integration/customer-type-approval.test.ts` for public-reason projection, hidden internal note, final-history preservation, and valid reapplication after rejection.
- [X] T030 [P] [US3] Add protected-to-protected request tests in `tests/integration/customer-type-approval.test.ts` confirming Wholesale stays effective while Gym Owner is pending.

### Implementation for User Story 3

- [X] T031 [US3] Extend customer history/state projection logic in `src/lib/customers/type-requests.ts` to provide chronological customer-safe finalized history and reapplication eligibility without exposing internal audit fields.
- [X] T032 [US3] Extend `src/components/storefront/customer-type-request.tsx` and `src/app/(storefront)/account/page.tsx` with approved/rejected/history/reapply states, public-reason display, and protected-to-protected transition messaging.
- [X] T033 [US3] Verify the US3 checkpoint with a rejected Wholesale reapplication and a Wholesale-to-Gym pending/approval flow using `tests/integration/customer-type-approval.test.ts` and the mobile RTL account UI.

**Checkpoint**: Customers see accurate status/history and can reapply without gaining unapproved privileges or seeing internal operational data.

---

## Phase 6: User Story 4 - Manage classifications operationally (Priority: P2)

**Goal**: Administrators can directly assign an active Customer Type, automatically superseding an active pending request, filter operational views, and reach work requiring attention from the dashboard.

**Independent Test**: Create a pending Wholesale request, directly assign Gym Owner as admin, verify effective Gym Owner, superseded request/history/audit, then filter it from the admin request/customer views and reach the pending queue from the dashboard.

### Tests for User Story 4

- [X] T034 [P] [US4] Add direct-assignment transition tests in `tests/integration/customer-type-approval.test.ts` for Retail-to-protected, protected-to-Retail, automatic supersession, audit prior/new type, and rejection of later finalization of the superseded request.
- [X] T035 [P] [US4] Add admin queue/filter/dashboard-count tests in `tests/integration/customer-type-approval.test.ts` for status/requested/effective type filters and Pending attention count.

### Implementation for User Story 4

- [X] T036 [US4] Add direct assignment and filtered admin projection queries in `src/lib/customers/type-approval.ts`, `src/lib/customers/type-requests.ts`, and `src/lib/data/admin-crud.ts` using only active target types and audit-backed results.
- [X] T037 [US4] Add the guarded direct-assignment handler in `src/app/api/admin/customers/[customerId]/customer-type/route.ts` and map stale/inactive/invalid outcomes to safe responses.
- [X] T038 [US4] Extend the Customer admin UI with effective type, pending request/history access, and an explicit direct-assignment action in `src/app/admin/(protected)/customers/page.tsx` and `src/components/admin/customer-type-assignment.tsx`.
- [X] T039 [US4] Add status/requested/effective-type filters to `src/app/admin/(protected)/customer-type-requests/page.tsx` and `src/components/admin/customer-type-request-queue.tsx` while retaining Pending as the default operational view.
- [X] T040 [US4] Add a real pending-request count to `src/lib/data/admin.ts` and a linked Needs Your Attention item in `src/app/admin/(protected)/page.tsx` that opens `/admin/customer-type-requests`.
- [X] T041 [US4] Verify the US4 checkpoint with direct protected and Retail assignment, pending-request supersession, final-state safety, filters, and attention navigation using `tests/integration/customer-type-approval.test.ts`.

**Checkpoint**: Admins can manage operational exceptions without unsafe type changes or a hidden pending request being revived later.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete migration, security, regression, accessibility, and documentation verification across all journeys.

- [X] T042 [P] Add migration/recovery verification coverage in `tests/integration/customer-type-approval.test.ts` for existing Customer Retail backfill and preservation of Auth links, addresses, orders, and guest checkout ownership.
- [X] T043 [P] Audit all new handlers and Customer modules in `src/app/api/customer/`, `src/app/api/admin/`, and `src/lib/customers/` for server-only secrets, `requireAdmin`, customer-session derivation, typed safe errors, and absence of direct browser mutation paths.
- [X] T044 [P] Verify every new label/state in `src/lib/i18n/translations.ts` and components in `src/components/{storefront,admin}/` for Arabic RTL, English LTR, 390 px touch targets, loading/error/empty states, and no horizontal overflow.
- [X] T045 Confirm Feature 004 boundary by reviewing `src/lib/pricing.ts`, `src/lib/cart.ts`, `src/app/(storefront)/checkout/page.tsx`, and new Customer Type code: only the effective-type query is exposed; no price, quantity, cart, checkout, payment, or order-total behavior changes.
- [ ] T046 Run the full verification commands and quickstart smoke matrix: `npm run test`, `npm run lint`, `npm run build`, then complete [quickstart.md](./quickstart.md) including Google login, profile, addresses, guest/auth checkout, orders, admin auth, COD, Kashier, Bosta, Mylerz, notifications, and analytics.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies; T002–T003 may run in parallel after T001’s naming convention is agreed.
- **Phase 2**: T004 before T005–T007; T008–T009 can run in parallel with schema work; T010–T012 depend on the finalized schema/command contract.
- **US1 (Phase 3)**: Depends on Phase 2. It is the MVP.
- **US2 (Phase 4)**: Depends on Phase 2 and uses the shared request foundation; it may start alongside US1 once those shared contracts are stable.
- **US3 (Phase 5)**: Depends on US1 state/history projections and US2 rejection behavior.
- **US4 (Phase 6)**: Depends on Phase 2; queue work may proceed with US2, while direct assignment integrates the shared transaction boundary.
- **Phase 7**: Depends on all selected user-story phases.

### User Story Dependencies

```text
Foundation
 ├── US1 Request commercial account (MVP)
 ├── US2 Review and decide requests
 │    └── US3 Status, history, and reapplication
 └── US4 Direct assignment, filters, and attention queue
```

### Parallel Opportunities

- T002/T003, T008/T009, and their test/design counterparts work in separate files.
- Once foundational database contracts are stable, US1 storefront work (T017–T019) and US2 admin UI work (T025–T027) can proceed in parallel.
- US4 queue/dashboard UI work can proceed in parallel with US2 detail UI after shared projections are defined.
- Test tasks carrying `[P]` are separate, independently runnable test additions; implementation dependencies still govern when they pass.

## Parallel Example: User Story 1

```text
T013: Request eligibility unit tests in tests/unit/customers/customer-types.test.ts
T014: Request route/integration tests in tests/integration/customer-type-approval.test.ts
T017: Arabic/English request copy in src/lib/i18n/translations.ts
```

After the shared domain command from T015 is complete, T016 and T018 can proceed in parallel; T019 integrates the completed UI and API.

## Implementation Strategy

### MVP First (US1 only)

1. Complete Setup and Foundation, especially the Retail backfill, one-pending invariant, guarded request command, and read projection.
2. Complete US1 request endpoint and Account Type section.
3. Run T020 to prove a customer can request a protected type without any effective-type or price change.
4. Demo the pending request lifecycle before implementing operational decisions.

### Incremental Delivery

1. Foundation → authoritative classification and safe requests.
2. US1 → customer application journey.
3. US2 → operational decision journey.
4. US3 → customer result/history/reapplication journey.
5. US4 → operational exception management and dashboard attention.
6. Phase 7 → full hardening and Feature 001 regression.

## Notes

- Every task uses the required checklist format, sequential ID, and exact project path.
- `[P]` marks tasks that can be worked independently in different files; it does not waive the listed data/contract dependency.
- Do not introduce pricing branches, communications automation, a new service/database, or broad authenticated write policies while completing these tasks.
