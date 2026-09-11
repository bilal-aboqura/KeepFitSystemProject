---

description: "Implementation tasks for Feature 001 customer identity, Google authentication, and account"

---

# Tasks: Customer Identity, Google Authentication & Account

**Input**: Design documents from `specs/001-customer-google-account/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/`

**Tests**: Targeted automated tests are mandatory because this feature changes identity,
authorization, customer data, order ownership, and storage security.

**Organization**: Tasks are grouped by user story so every story can be independently
implemented and verified after the shared security foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable after its dependencies are complete and it changes different files.
- **[Story]**: Maps the task to the associated user story. Foundation tasks intentionally omit it.
- Every task includes an exact repository path.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish repeatable development, migration, and test entry points without
changing customer behavior.

- [X] T001 Add Vitest scripts, configuration, and test environment setup in `package.json`, `vitest.config.ts`, and `tests/setup.ts`
- [X] T002 [P] Add customer-domain test fixtures and Supabase test helpers in `tests/helpers/customer-fixtures.ts` and `tests/helpers/supabase-test-db.ts`
- [X] T003 [P] Add the Feature 001 migration runner skeleton using `DIRECT_URL` in `scripts/migrate-feature-001.mjs`
- [X] T004 [P] Document local/production Google OAuth callback configuration requirements in `.env.example` and `README.md`
- [X] T005 Add Feature 001 migration and regression commands to `AGENTS.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish canonical customer data, transactional integrity, RLS, and shared
server boundaries before customer-facing stories begin.

**⚠️ CRITICAL**: No customer story starts until this phase is complete.

- [X] T006 Create the ordered additive Customer, address-ownership, order-ownership, confirmation-grant, index, and partial-default-index migration in `supabase/migrations/001_customer_identity.sql`
- [X] T007 Update convergent Customer, address, order, function, grant, and RLS definitions in `supabase/schema.sql`
- [X] T008 Implement server-only Customer domain types and canonical ownership representations in `src/lib/customers/types.ts`
- [X] T009 [P] Extract shared Egyptian phone normalization and Zod schemas from checkout rules into `src/lib/customers/validation.ts`
- [X] T010 Implement idempotent Auth-user-to-Customer resolver and completeness predicate in `src/lib/customers/identity.ts`
- [X] T011 Implement current-session Customer lookup and customer-route authorization helpers in `src/lib/customers/session.ts`
- [X] T012 Implement allowed-field Customer profile query/update service with synchronized auth projection in `src/lib/customers/profile.ts`
- [X] T013 Implement Customer-owned address query/command service with atomic default transitions in `src/lib/customers/addresses.ts`
- [X] T014 Implement Customer-owned order queries and guest-confirmation grant verification in `src/lib/customers/queries.ts`
- [X] T015 Replace broad authenticated product-media mutation policies with the admin-only policy in `supabase/migrations/001_customer_identity.sql` and `supabase/schema.sql`
- [X] T016 Add unit tests for normalization, shared-phone acceptance, resolver idempotency, profile completeness, and privileged-field rejection in `tests/unit/customers/identity-profile.test.ts`
- [X] T017 Add database integration tests for RLS ownership, default-address invariant, Customer/Auth uniqueness, and customer storage denial in `tests/integration/security/customer-rls-storage.test.ts`
- [ ] T018 Run the Feature 001 migration against an isolated test database and record schema/RLS validation in `tests/integration/security/migration-validation.test.ts`

**Checkpoint**: Customer ownership is canonical, transactional primitives exist, normal users
cannot mutate product media, and RLS negative cases pass.

---

## Phase 3: User Story 1 - Sign in and establish an account (Priority: P1) 🎯 MVP

**Goal**: A shopper can sign in with Google, resolve one Customer deterministically, complete
required commerce profile data, see authenticated storefront state, and sign out.

**Independent Test**: A new Google identity creates one Customer, a repeated login resolves
it, an incomplete account completes profile information, and sign-out blocks account access.

### Tests for User Story 1

- [X] T019 [P] [US1] Add OAuth callback, safe-local-return, resolver, cancellation, and returning-user handler tests in `tests/integration/customer-account/oauth-callback.test.ts`
- [X] T020 [P] [US1] Add protected customer-route and logout session tests in `tests/integration/customer-account/customer-session.test.ts`

### Implementation for User Story 1

- [X] T021 [US1] Implement Google sign-in initiation with validated local return paths in `src/app/api/customer/auth/google/route.ts`
- [X] T022 [US1] Implement SSR OAuth code exchange, Customer resolution, profile-completion redirect, and generic failure redirect in `src/app/auth/callback/route.ts`
- [X] T023 [P] [US1] Implement the reusable storefront Google sign-in and sign-out action component in `src/components/storefront/customer-auth.tsx`
- [X] T024 [US1] Add session-aware account/sign-in state to `src/components/storefront/navbar.tsx`
- [X] T025 [US1] Add authenticated customer route protection while retaining proxy session refresh and admin guards in `src/proxy.ts`
- [X] T026 [US1] Create the mobile-first account shell and protected Overview route in `src/app/(storefront)/account/layout.tsx` and `src/app/(storefront)/account/page.tsx`
- [X] T027 [US1] Create profile-completion form, loading/error states, and completion redirect in `src/app/(storefront)/account/complete-profile/page.tsx` and `src/components/storefront/customer-profile-form.tsx`
- [X] T028 [US1] Implement authenticated self-profile read/update endpoint using only allow-listed fields in `src/app/api/customer/me/route.ts`
- [X] T029 [US1] Wire profile-completeness checks into authenticated storefront/account entry in `src/app/(storefront)/layout.tsx`

**Checkpoint**: Google is the only customer login method; customer sessions never grant admin
access; incomplete customers can browse but are directed to complete required data.

---

## Phase 4: User Story 2 - Maintain account and delivery details (Priority: P1)

**Goal**: A signed-in customer can safely view/edit permitted profile data and manage owned
delivery addresses with correct default behavior.

**Independent Test**: Customer A edits permitted fields and address defaults; Customer B is
unable to read, modify, or delete any of Customer A's records.

### Tests for User Story 2

- [X] T030 [P] [US2] Add profile endpoint allow-list and cross-customer authorization tests in `tests/integration/customer-account/profile-api.test.ts`
- [X] T031 [P] [US2] Add address CRUD, ownership, first-default, switching-default, and deletion-default tests in `tests/integration/customer-account/address-api.test.ts`

### Implementation for User Story 2

- [X] T032 [US2] Create permitted profile view/edit page with mobile RTL loading and error states in `src/app/(storefront)/account/profile/page.tsx`
- [X] T033 [US2] Create address list empty state and mobile account page in `src/app/(storefront)/account/addresses/page.tsx`
- [X] T034 [P] [US2] Create reusable address editor/default-selection form in `src/components/storefront/customer-address-form.tsx`
- [X] T035 [US2] Implement owned address list/create handler in `src/app/api/customer/addresses/route.ts`
- [X] T036 [US2] Implement owned address update/delete handler in `src/app/api/customer/addresses/[id]/route.ts`
- [X] T037 [US2] Implement atomic owned-address default selection handler in `src/app/api/customer/addresses/[id]/default/route.ts`
- [X] T038 [US2] Add Customer profile and address actions to account overview navigation in `src/app/(storefront)/account/page.tsx`
- [ ] T039 [US2] Verify all profile/address forms retain Arabic RTL, English LTR, touch targets, and no-horizontal-scroll behavior at 390px in `tests/integration/customer-account/mobile-account-ui.test.tsx`

**Checkpoint**: Profile fields are constrained at the server boundary; each customer sees only
their own addresses; the default-address invariant is maintained beyond the UI.

---

## Phase 5: User Story 3 - Place and view securely associated orders (Priority: P1)

**Goal**: New authenticated orders receive Customer ownership and are visible only to that
Customer, while guests retain checkout and private confirmation access.

**Independent Test**: An authenticated profile-complete customer completes an order and sees
it in My Orders; another customer is denied; a guest completes checkout and can only use its
own confirmation grant.

### Tests for User Story 3

- [X] T040 [P] [US3] Add atomic order creation, authenticated Customer association, guest preservation, and immutable snapshot tests in `tests/integration/customer-account/order-creation.test.ts`
- [X] T041 [P] [US3] Add owned order-list/detail and cross-customer denial tests in `tests/integration/customer-account/order-ownership.test.ts`
- [X] T042 [P] [US3] Add guest confirmation cookie grant, expiry, mismatch, and order-number-only denial tests in `tests/integration/security/guest-confirmation.test.ts`

### Implementation for User Story 3

- [X] T043 [US3] Replace independent order/order-item persistence with the atomic server-owned order RPC path in `src/lib/data/orders.ts`
- [X] T044 [US3] Associate profile-complete authenticated checkout with canonical Customer and retain `user_id` compatibility in `src/app/api/orders/route.ts`
- [X] T045 [US3] Preserve guest checkout and issue secure guest confirmation cookie grants in `src/app/api/orders/route.ts`
- [X] T046 [US3] Update checkout to show authenticated profile-completion guidance while preserving guest form and payment/shipping inputs in `src/app/(storefront)/checkout/page.tsx`
- [X] T047 [US3] Implement owned order summary/detail handlers filtered by `customer_id` in `src/app/api/customer/orders/route.ts` and `src/app/api/customer/orders/[orderNumber]/route.ts`
- [X] T048 [US3] Create My Orders list with empty/loading/error states in `src/app/(storefront)/account/orders/page.tsx`
- [X] T049 [US3] Create owned account order detail page in `src/app/(storefront)/account/orders/[orderNumber]/page.tsx`
- [X] T050 [US3] Replace order-number-only checkout-success retrieval with authenticated ownership or valid guest grant verification in `src/app/(storefront)/checkout/success/page.tsx`
- [X] T051 [US3] Verify Kashier return, Bosta/Mylerz input, notification, Meta, analytics, COD, and guest/authenticated checkout compatibility in `tests/integration/customer-account/order-integration-regression.test.ts` and `tests/integration/customer-account/provider-snapshot-regression.test.ts`

**Checkpoint**: All new authenticated orders have canonical ownership and immutable snapshots;
guest checkout is unchanged except for private confirmation protection.

---

## Phase 6: User Story 4 - Identify real customers in administration (Priority: P2)

**Goal**: Authorized administrators can distinguish persistent Customer records from
order-derived guest information without gaining unrelated Feature 002 functionality.

**Independent Test**: An admin sees required Customer identity fields and useful order
relationship data; a normal customer cannot access the page or admin API.

### Tests for User Story 4

- [X] T052 [P] [US4] Add persistent-customer admin query and normal-customer admin-denial tests in `tests/integration/security/admin-customer-regression.test.ts`

### Implementation for User Story 4

- [X] T053 [US4] Add persistent Customer admin query with basic order aggregates and guest/order-derived distinction in `src/lib/data/admin-crud.ts`
- [X] T054 [US4] Evolve the protected customer page to display Customer ID, name, email, phone, auth link, date, and basic order relationship in `src/app/admin/(protected)/customers/page.tsx`
- [X] T055 [US4] Preserve `requireAdmin` and verify all customer-related admin access stays within `src/lib/admin-auth.ts` and `src/app/admin/(protected)/layout.tsx`

**Checkpoint**: Admins can recognize canonical Customers, but customer types, approval,
pricing, balances, notes, and CRM segmentation remain absent.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Close constitutional quality gates and verify no existing operations regress.

- [X] T056 [P] Add identity-resolution, profile-update, and exceptional customer-association audit records in `src/lib/customers/audit.ts` and `supabase/migrations/001_customer_identity.sql`
- [X] T057 [P] Add customer-facing Arabic/English authentication, account, address, order, and unauthorized error copy in `src/lib/i18n/translations.ts`
- [X] T058 [P] Add account accessibility semantics, focus handling, and loading/duplicate-submit guards in `src/components/storefront/customer-auth.tsx`, `src/components/storefront/customer-profile-form.tsx`, and `src/components/storefront/customer-address-form.tsx`
- [ ] T059 Verify Google provider, Supabase redirect allow-list, local callback, and production callback configuration without committing secrets in `.env.example` and `README.md`
- [X] T060 Run Feature 001 migration backup/preflight/postflight validation using `scripts/migrate-feature-001.mjs` and `tests/integration/security/migration-validation.test.ts`
- [X] T061 Run targeted Vitest coverage for all Feature 001 suites in `tests/unit/customers/` and `tests/integration/`
- [X] T062 Run lint and production build from `package.json` with `npm run lint` and `npm run build`
- [ ] T063 Run manual 390px RTL acceptance for authentication, profile completion, account navigation, addresses, orders, confirmation, and sign-out using `specs/001-customer-google-account/quickstart.md`
- [ ] T064 Run guest/authenticated COD/card, Kashier, Bosta, Mylerz, notifications, Meta, analytics, and admin smoke regression using `specs/001-customer-google-account/quickstart.md`
- [X] T065 Reconcile implementation, tests, affected existing behavior, and unresolved work against `specs/001-customer-google-account/spec.md` and `.specify/memory/constitution.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundation (Phase 2)**: Depends on setup and blocks all user stories.
- **US1 (Phase 3)**: Starts after foundation; establishes OAuth/session/customer completion.
- **US2 (Phase 4)**: Starts after foundation and uses US1 session/account shell.
- **US3 (Phase 5)**: Starts after foundation and depends on US1 for authenticated Customer flows; guest regression remains independent.
- **US4 (Phase 6)**: Starts after foundation; should follow Customer schema/query stabilization.
- **Polish (Phase 7)**: Depends on all selected user stories.

### User Story Dependency Graph

```text
Foundation
├── US1: Google authentication and account foundation
│   ├── US2: Profile and saved addresses
│   └── US3: Authenticated checkout, orders, and confirmation
└── US4: Minimal admin Customer visibility

US2 + US3 + US4 → Cross-cutting regression and feature closure
```

### Parallel Opportunities

- T002–T004 can proceed in parallel after T001's testing choices are established.
- T009 and T015 can proceed independently while T006–T008 establish schema/types.
- T019/T020, T030/T031, T040–T042, and T052 are parallel test tasks in distinct files.
- US2 and US4 can proceed in parallel after US1 session/account foundations stabilize.
- UI translation/accessibility work T057/T058 can proceed alongside late integration testing.

## Parallel Example: User Story 3

```text
Task: "Add atomic order and snapshot tests in tests/integration/customer-account/order-creation.test.ts"
Task: "Add ownership tests in tests/integration/customer-account/order-ownership.test.ts"
Task: "Add guest grant security tests in tests/integration/security/guest-confirmation.test.ts"

Task: "Implement customer order handlers in src/app/api/customer/orders/"
Task: "Create My Orders UI in src/app/(storefront)/account/orders/"
```

## Implementation Strategy

### MVP First

1. Complete Phases 1 and 2.
2. Complete US1: secure Google customer identity, session state, and profile completion.
3. Validate repeat identity resolution, no admin privilege escalation, sign-out, and mobile RTL.
4. Demonstrate the authenticated storefront account foundation before extending checkout.

### Incremental Delivery

1. Foundation + US1 → customer identity and login value.
2. Add US2 → self-service profile/address value.
3. Add US3 → safe authenticated order history while preserving guests.
4. Add US4 → operational visibility without Feature 002 scope creep.
5. Finish Phase 7 only after every acceptance/regression gate passes.

## Notes

- Do not mark an order owned based on matching name, email, or phone.
- Do not make checkout authentication mandatory.
- Do not add customer type, approval, price list, pricing, inventory, or order-lifecycle work.
- The client-price acceptance risk remains explicitly deferred to Feature 004/005; do not
  silently claim it is resolved by this feature's atomic write.
