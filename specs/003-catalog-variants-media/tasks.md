# Tasks: Catalog, Variants, Attributes & Product Media

**Input**: Design documents from `/specs/003-catalog-variants-media/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [catalog-api.md](./contracts/catalog-api.md), [quickstart.md](./quickstart.md)

**Tests**: Automated tests are mandatory for Catalog integrity, authorization, R2 media lifecycle, cart/order compatibility, and all Feature 003 regression boundaries.

**Organization**: Tasks are grouped by independently testable user journey after shared catalog foundations are complete.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish Feature 003 dependencies, configuration documentation, migration runner, and test scaffolding.

- [X] T001 Add AWS S3-compatible R2 client/presigner dependencies, the Feature 003 migration command, and R2 non-secret configuration names in `package.json`, `package-lock.json`, and `.env.example`.
- [X] T002 Create the transaction-safe Feature 003 migration runner in `scripts/migrate-feature-003.mjs` following `scripts/migrate-feature-001.mjs`.
- [X] T003 [P] Add R2/catalog fixtures and server-only mocks in `tests/helpers/catalog-fixtures.ts` and `tests/helpers/r2-mock.ts`.
- [X] T004 [P] Create the Catalog test suites in `tests/unit/catalog/catalog-validation.test.ts`, `tests/unit/catalog/media-storage.test.ts`, and `tests/integration/catalog-variants-media.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the canonical catalog data model, integrity constraints, migration/backfill, access controls, and server-only domain boundaries required by every journey.

**⚠️ CRITICAL**: Complete this phase before starting storefront or admin catalog UI work.

- [X] T005 Create `supabase/migrations/003_catalog_variants_media.sql` with additive Brand, Product Variant, Attribute Definition/Value, Product Specification, Variant Attribute Assignment, Catalog Media, and media-association structures.
- [X] T006 Extend `supabase/migrations/003_catalog_variants_media.sql` to evolve `products`, Categories, `order_items`, and compatibility fields; backfill one default Variant per existing Product while preserving Product IDs, URLs, legacy price/stock/images, orders, and current integrations.
- [X] T007 Add authoritative database constraints/indexes in `supabase/migrations/003_catalog_variants_media.sql` for globally permanent SKU uniqueness, per-Product active defining-combination uniqueness, valid ownership/attribute associations, one active primary Product image, and active-sellable Product/Variant invariants.
- [X] T008 Add narrow catalog/public-read RLS and server-only mutation grants in `supabase/migrations/003_catalog_variants_media.sql`, denying Customer direct catalog, attribute, Variant, media, and R2-lifecycle mutation.
- [X] T009 Update convergent definitions, RLS, grants, and compatibility notes in `supabase/schema.sql` to match the Feature 003 migration without removing legacy media/order support.
- [X] T010 [P] Create canonical Catalog domain interfaces, media projections, stable codes, and cart/order snapshot types in `src/lib/catalog/types.ts`.
- [X] T011 [P] Implement strict Zod schemas and canonical defining-attribute fingerprint validation in `src/lib/catalog/validation.ts`, including permanent SKU, controlled/typed values, bounded fields, and media metadata validation.
- [X] T012 Implement server-only Brand, Category, Attribute, Product, and Variant queries/commands in `src/lib/catalog/{brands,categories,attributes,products,variants,queries}.ts` with publishability, archive, material-identity-change, and transaction-result handling.
- [X] T013 Implement new catalog domain tests in `tests/unit/catalog/catalog-validation.test.ts` and `tests/integration/catalog-variants-media.test.ts` for default Variant migration, permanent SKU reservation, duplicate combinations, active-sellable validity, typed/informational attributes, and RLS/admin denial.

**Checkpoint**: Every Product has a safe Variant foundation, only server-authorized commands can mutate Catalog state, and Features 001/002 data remains intact.

---

## Phase 3: User Story 1 - Create a sellable variant catalog (Priority: P1) 🎯 MVP

**Goal**: An authorized administrator can create Category/Brand/Product plus one or more valid sellable Variants with stable identity, globally reserved SKU, and type-neutral base-price compatibility.

**Independent Test**: Create a Protein Powder Product with Category, Brand, and four Weight/Flavor Variants; verify unique identities/SKUs, reject duplicates, and publish only with an active Variant.

### Tests for User Story 1

- [X] T014 [P] [US1] Add Product/Variant command and contract tests in `tests/integration/catalog-variants-media.test.ts` for atomic Product-plus-default-Variant creation, Category/Brand ownership, permanent SKU rejection, and duplicate active combination conflict.
- [X] T015 [P] [US1] Add Product publish/archive/material-Variant-edit tests in `tests/integration/catalog-variants-media.test.ts` for active-Variant requirement, Product edits preserving Variant IDs, and referenced-Variant archive/replacement safety.

### Implementation for User Story 1

- [X] T016 [US1] Implement atomic Product/default-Variant, Product update/archive, and safe Variant create/archive commands in `src/lib/catalog/products.ts` and `src/lib/catalog/variants.ts` using the T005–T008 transaction/integrity rules.
- [X] T017 [US1] Add admin Product and Variant command handlers in `src/app/api/admin/catalog/products/route.ts`, `src/app/api/admin/catalog/products/[productId]/route.ts`, `src/app/api/admin/catalog/products/[productId]/variants/route.ts`, and `src/app/api/admin/catalog/variants/[variantId]/route.ts` guarded by `requireAdmin`.
- [X] T018 [P] [US1] Add reusable Brand and Category management handlers in `src/app/api/admin/catalog/brands/route.ts` and `src/app/api/admin/catalog/categories/route.ts` using the Catalog domain commands.
- [X] T019 [P] [US1] Add Arabic/English catalog, Variant, SKU, Category, Brand, and validation messages in `src/lib/i18n/translations.ts` without using display labels as business identifiers.
- [X] T020 [US1] Replace the legacy Product-only admin form with a structured Product/Variant editor in `src/components/admin/catalog-product-editor.tsx` and integrate it into `src/app/admin/(protected)/products/new/page.tsx` and `src/app/admin/(protected)/products/[id]/page.tsx`.
- [X] T021 [US1] Add the US1 checkpoint coverage in `tests/integration/catalog-variants-media.test.ts` and verify a default single Variant and reviewed multi-Variant Product can be created without Customer-Type price behavior.

**Checkpoint**: Admins can create a valid sellable Product model; Variant is the stable sellable identity and SKU is permanently reserved.

---

## Phase 4: User Story 2 - Browse and select the correct Variant (Priority: P1)

**Goal**: Customers browse active Products, select one valid human-readable Variant, see type-neutral compatibility information, and add its Variant identity to cart; inactive/ambiguous states fail safely.

**Independent Test**: Open a multi-Variant Product, select 5 LB/Vanilla, add it to cart with the matching `variant_id`, then verify a single-Variant Product auto-selects and an inactive Variant cannot be purchased.

### Tests for User Story 2

- [X] T022 [P] [US2] Add Variant-aware storefront query and resolver tests in `tests/integration/catalog-variants-media.test.ts` for active-only Product/Variant projections, deterministic valid selection, invalid combination refusal, and single-Variant auto-selection.
- [X] T023 [P] [US2] Add cart/order compatibility tests in `tests/integration/catalog-variants-media.test.ts` for new `variant_id` items, safe default-Variant legacy mapping, ambiguous Product-only recovery, inactive Variant denial, and new order Variant/SKU snapshots.

### Implementation for User Story 2

- [X] T024 [US2] Replace Product-only storefront projections with active Variant-aware list/detail/search/filter queries in `src/lib/catalog/queries.ts` and adapt `src/lib/data/catalog.ts` as the compatibility facade.
- [X] T025 [US2] Extend `src/lib/cart.ts` with `variant_id` item identity, display snapshots, exact-one-default legacy migration, and safe ambiguous-entry removal.
- [X] T026 [US2] Update server order validation/snapshot creation in `src/app/api/orders/route.ts` and `src/lib/data/orders.ts` so new lines validate active Variants and persist Variant/SKU/Product/price snapshots without rewriting historical lines.
- [X] T027 [P] [US2] Create human-readable Variant option resolver, selector, and single-Variant behavior in `src/components/storefront/variant-selector.tsx` and update `src/components/storefront/product-purchase-box.tsx`.
- [X] T028 [US2] Update active catalog/product detail/category/search pages in `src/app/(storefront)/product/[slug]/page.tsx`, `src/app/(storefront)/category/[slug]/page.tsx`, and `src/app/(storefront)/page.tsx` to consume Variant-aware projections and selection state.
- [X] T029 [US2] Verify the US2 checkpoint with multi/single Variant, inactive Variant, legacy cart, and new order journeys in `tests/integration/catalog-variants-media.test.ts`; confirm equivalent Customer Types retain the same current base price.

**Checkpoint**: Customers can only purchase an active selected Variant, and cart/order identity moves forward without breaking existing Product URLs or historical orders.

---

## Phase 5: User Story 3 - Manage flexible attributes and catalog media (Priority: P2)

**Goal**: Admins manage reusable Attributes/specifications and secure ordered Product/Variant media stored in R2, with Variant-media fallback and archive-before-cleanup lifecycle safety.

**Independent Test**: Configure Weight/Flavor as Variant-defining and Form as informational; upload/reorder Product media, choose one primary, attach Variant media, and confirm shared/archived object cleanup is safe.

### Tests for User Story 3

- [X] T030 [P] [US3] Add Attribute management and assignment tests in `tests/unit/catalog/catalog-validation.test.ts` and `tests/integration/catalog-variants-media.test.ts` for controlled options, numeric/text values, informational specifications, typed validation, and defining-combination fingerprints.
- [X] T031 [P] [US3] Add mocked R2 media tests in `tests/unit/catalog/media-storage.test.ts` and `tests/integration/catalog-variants-media.test.ts` for admin-only upload intent, MIME/size/dimension denial, confirmation failure, primary/order integrity, Variant fallback, shared references, archive-first lifecycle, and idempotent cleanup.

### Implementation for User Story 3

- [X] T032 [US3] Implement Attribute Definition/Value/specification/Variant-assignment commands and admin projections in `src/lib/catalog/attributes.ts` and `src/app/api/admin/catalog/attributes/route.ts`.
- [X] T033 [US3] Implement server-only R2 configuration, presigned upload intent, confirmation, public URL resolution, and zero-reference cleanup adapter in `src/lib/catalog/media/{storage,r2,validation,cleanup}.ts`.
- [X] T034 [US3] Add admin-only media upload-intent, confirm, reorder/primary, and archive handlers in `src/app/api/admin/catalog/media/upload-intents/route.ts`, `src/app/api/admin/catalog/media/confirm/route.ts`, and `src/app/api/admin/catalog/media/[mediaId]/route.ts`.
- [X] T035 [P] [US3] Add Attribute management and Product specification/Variant-assignment editor UI in `src/components/admin/catalog-attribute-manager.tsx` and `src/components/admin/catalog-product-editor.tsx`.
- [X] T036 [P] [US3] Add secure ordered gallery and Variant-media administration UI in `src/components/admin/catalog-media-manager.tsx` and extend `src/components/admin/catalog-product-editor.tsx`.
- [X] T037 [US3] Add R2 public image configuration and strict remote patterns in `next.config.ts`, plus documented R2 environment separation in `.env.example`, without exposing credentials to Client Components.
- [X] T038 [US3] Add Product gallery/Variant-media fallback behavior to `src/components/storefront/product-gallery.tsx` and integrate it with `src/components/storefront/product-purchase-box.tsx`.
- [ ] T039 [US3] Verify the US3 checkpoint in `tests/integration/catalog-variants-media.test.ts` with a controlled non-production R2 smoke test, no production-bucket access, and archive-before-delete reference safety.

**Checkpoint**: Flexible attributes create only intentional Variants; R2 media is securely administered, ordered, and safely archived/cleaned up.

---

## Phase 6: User Story 4 - Operate and retire catalog records safely (Priority: P2)

**Goal**: Admins can search/filter Catalog records, safely archive Products/Variants, and retain history while storefront purchase behavior excludes inactive records.

**Independent Test**: Search a catalog by Arabic name, SKU, barcode, Brand, and Category; archive a purchased Variant and verify it remains identifiable in historic orders but cannot be newly purchased.

### Tests for User Story 4

- [X] T040 [P] [US4] Add admin search/filter/archive tests in `tests/integration/catalog-variants-media.test.ts` for Product/Variant name, SKU, barcode, Brand, Category, status, and historical-order preservation.
- [X] T041 [P] [US4] Add authorization/audit-compatible lifecycle tests in `tests/integration/catalog-variants-media.test.ts` for non-admin denial, inactive storefront/cart refusal, SKU preservation after archive, and sensitive mutation event records.

### Implementation for User Story 4

- [X] T042 [US4] Add filtered admin Catalog list/search/history projections in `src/lib/catalog/queries.ts` and `src/lib/data/admin-crud.ts` using stable IDs/codes and active/archive state.
- [X] T043 [US4] Add Product/Variant archive actions and audit-compatible lifecycle records in `src/lib/catalog/products.ts`, `src/lib/catalog/variants.ts`, and `src/app/api/admin/catalog/variants/[variantId]/route.ts`.
- [X] T044 [US4] Replace the admin Product list with search/filter/Brand/Category/Variant-count/primary-image/status support in `src/app/admin/(protected)/products/page.tsx` and `src/components/admin/catalog-product-list.tsx`.
- [X] T045 [US4] Add focused Brand, Category, and Attribute administration pages in `src/app/admin/(protected)/catalog/brands/page.tsx`, `src/app/admin/(protected)/catalog/categories/page.tsx`, and `src/app/admin/(protected)/catalog/attributes/page.tsx`.
- [X] T046 [US4] Add Catalog administration navigation and localized labels in `src/components/admin/sidebar.tsx` and `src/lib/i18n/translations.ts`.
- [X] T047 [US4] Verify the US4 checkpoint with search/filter, archived Variant/new-purchase denial, historical order readability, and audit-compatible lifecycle tests in `tests/integration/catalog-variants-media.test.ts`.

**Checkpoint**: Catalog operations are searchable and safe; archival protects commercial history without allowing inactive units into new sales.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate migration, security, SEO, responsive UX, Feature 004 readiness, and all preserved integration behavior.

- [X] T048 [P] Add a reproducible non-production-only five-shape demo catalog seed/reset workflow in `scripts/seed-catalog-demo.mjs` and document its non-production guard in `README.md`.
- [X] T049 [P] Update SEO/catalog URL behavior in `src/app/sitemap.ts`, `src/components/seo/product-json-ld.tsx`, and `src/app/(storefront)/product/[slug]/page.tsx` for Variant-aware Offer data while keeping one Product page per slug.
- [X] T050 [P] Review all new Catalog/API/media files under `src/lib/catalog/` and `src/app/api/admin/catalog/` for server-only R2 secrets, `requireAdmin`, narrow errors, RLS alignment, and no direct Customer mutation path.
- [X] T051 [P] Verify `src/lib/i18n/translations.ts`, `src/components/{storefront,admin}/`, and `src/app/{(storefront),admin}/` for Arabic RTL/English LTR, 390 px touch targets, gallery/selector loading-error-empty states, and no horizontal overflow.
- [X] T052 Confirm Feature 004/Inventory boundaries by reviewing `src/lib/catalog/`, `src/lib/pricing.ts`, `src/lib/cart.ts`, and `src/app/api/orders/route.ts`: expose Variant identity only; add no Customer-Type pricing, price lists, quantity rules, inventory ledger, reservations, or warehouse behavior.
- [ ] T053 Run the full quickstart verification: `npm run test`, `npm run lint`, `npm run build`, Feature 003 migration validation, non-production R2 smoke, and Feature 001/002 plus guest/authenticated checkout, COD, Kashier, Bosta, Mylerz, notifications, Meta, analytics, sitemap, and JSON-LD regression checks from `specs/003-catalog-variants-media/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies; T003/T004 can start once T001 establishes dependencies/configuration names.
- **Phase 2**: T005–T009 define the database foundation; T010/T011 can proceed in parallel; T012/T013 require the finalized schema/command contract.
- **US1 (Phase 3)**: Depends on Phase 2 and is the Catalog MVP.
- **US2 (Phase 4)**: Depends on Phase 2; it consumes the shared Product/Variant contract and may begin after T016 stabilizes the creation projection.
- **US3 (Phase 5)**: Depends on Phase 2; Attribute editor integration follows US1, and media gallery integration follows Variant queries from US2.
- **US4 (Phase 6)**: Depends on Phase 2; operational list UI may proceed in parallel with US3 after shared projections are stable.
- **Phase 7**: Depends on all desired user-story phases.

### User Story Dependencies

```text
Foundation
 ├── US1 Create sellable Variant catalog (MVP)
 │    └── US2 Browse/select Variant
 ├── US3 Flexible attributes and R2 media
 └── US4 Search, archive, and safe operations
```

### Parallel Opportunities

- T003/T004, T010/T011, and `[P]` tests work in independent files.
- After the Catalog contract stabilizes, US1 editor/localization, US2 selector, and US3 media-adapter work can be split across contributors.
- US4 list/search UI can proceed alongside US3 gallery/attribute UI once the shared query projections are available.
- `[P]` means files can be worked independently; it does not bypass listed database/domain dependencies.

## Parallel Example: User Story 3

```text
T030: Attribute assignment tests in tests/unit/catalog/catalog-validation.test.ts
T031: R2 media lifecycle tests in tests/unit/catalog/media-storage.test.ts
T035: Attribute management UI in src/components/admin/catalog-attribute-manager.tsx
T036: Media gallery UI in src/components/admin/catalog-media-manager.tsx
```

After T032/T033 define the domain and storage contracts, T034 and the two UI tasks can be integrated independently.

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phases 1–2, including safe default-Variant migration and permanent SKU/combination invariants.
2. Complete US1 Product/Variant server commands and focused admin editor.
3. Validate T021: create single and multi-Variant Products without Customer-Type price behavior.
4. Demonstrate a valid canonical Catalog before changing storefront cart identity or media provider.

### Incremental Delivery

1. Foundation → canonical Variant authority and safe migration.
2. US1 → admin sellable Catalog creation.
3. US2 → customer Variant selection and cart/order identity.
4. US3 → flexible attributes plus R2 media lifecycle.
5. US4 → operational search/archival safety.
6. Phase 7 → migration, security, SEO, R2, and full regression hardening.

## Notes

- All tasks use the required checkbox, sequential ID, optional `[P]`, required story label for story work, and exact paths.
- Do not use customer-visible translated labels for Catalog business identity.
- Do not introduce pricing rules, inventory ledger behavior, a separate service/database, broad authenticated mutation, or browser-exposed R2 credentials while implementing these tasks.
