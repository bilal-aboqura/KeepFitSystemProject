# Implementation Plan: Catalog, Variants, Packaging, Attributes & Product Media

**Branch**: `003-catalog-variants-media` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)
**Input**: Approved Feature 003 specification, SKU/media clarification decisions, constitution, Feature 001/002 foundations, current repository, and supplied technical direction.

## Summary

Evolve the current Product-level catalog into one modular-monolith Catalog domain: Product remains the browseable concept, Variant becomes the canonical product configuration, and Sellable Unit identifies the Box/Strip/Ampoule/etc. quantity selected for commerce. Add exact generic packaging hierarchies alongside persistent Brands, extensible attributes, globally permanent SKUs, catalog media records, and R2-backed media. Migrate existing Products additively to one default Variant and one one-to-one default/base Sellable Unit, preserve URLs/history/legacy media, move new cart and order lines to Variant + Unit identity, and expose exact conversion facts to Feature 004 without implementing Customer-context price resolution in Catalog.

## Technical Context

**Language/Version**: TypeScript, Next.js 16.2.9, React 19.2.4  
**Primary Dependencies**: Supabase JS/SSR, Supabase PostgreSQL/Auth, Zod, Vitest; add AWS S3-compatible client/presigner packages for R2 server-only access  
**Storage**: Supabase PostgreSQL for catalog state; Cloudflare R2 for all new catalog media; existing Supabase Storage only for legacy media compatibility  
**Testing**: Vitest unit/integration tests, `npm run lint`, `npm run build`, mocked R2 tests, controlled non-production R2 smoke test, manual Arabic RTL/mobile validation  
**Target Platform**: Responsive web, Arabic RTL-first/English LTR, approximately 390 px mobile viewport  
**Project Type**: Existing Next.js App Router modular-monolith web application  
**Performance Goals**: Catalog listing/detail and selected-Variant state usable within 2 seconds on a normal mobile connection; admin media feedback is immediate and never falsely reports success  
**Constraints**: Variant is the canonical configuration; Sellable Unit is the selected packaging identity; conversion arithmetic is exact; SKU is globally unique forever; no Customer-context pricing or inventory ledger; R2 credentials are server-only; inactive/non-sellable Units cannot be purchased
**Scale/Scope**: One application/database; arbitrary-depth deterministic packaging per Variant; demo catalog covers two-/three-level and nested wholesale packaging; R2 uses isolated non-production/production configuration and a configurable custom serving domain

## Constitution Check

*GATE: Passed before research and re-checked after design.*

- [x] Extends the existing Next.js/Supabase modular monolith and does not create a parallel catalog, service, or database.
- [x] Makes Variant the canonical catalog configuration and Sellable Unit the orderable packaging identity while Products retain catalog/SEO identity.
- [x] Keeps Catalog conversion facts exact and type-neutral; Feature 004 alone owns Price List, Customer-Type, override, derived-money, and rounding behavior.
- [x] Places SKU, packaging graph/base/default/sellability, combination, publishability, media-primary, archival, and purchase eligibility rules in authoritative server/database boundaries.
- [x] Isolates R2 behind an intentional media adapter, avoids browser credentials, and defines failure/cleanup behavior without a new queue architecture.
- [x] Requires targeted migration, authorization, cart/order compatibility, media lifecycle, and existing-functionality regression tests.

## Technical Architecture

### Canonical catalog relationships

```text
categories ──┐
brands ──────┼──→ products ──→ product_specifications
             │       │
             │       ├──→ catalog_media ←── variant_media
             │       └──→ product_variants ──→ variant_attribute_values
             │                    │             │
             │                    └──→ variant_packaging_units (self-parent hierarchy)
attribute_definitions ──→ attribute_values ─────┘

new cart_items/order_items → product_variants + variant_packaging_units
historical order_items → existing product/snapshot fields (preserved)
```

`products.id` remains the Product/SEO identity. `product_variants.id` becomes the canonical product-configuration identity and owns SKU, optional barcode, default-unit compatibility price, current stock compatibility, active/archive state, and a deterministic defining-attribute fingerprint. `variant_packaging_units.id` identifies the selected package quantity under that Variant. Product specifications and packaging labels never enter the Variant fingerprint. Feature 004 consumes `(Customer, Variant, Sellable Unit)`; later inventory consumes Variant/Unit identity plus exact base equivalent.

### Packaging hierarchy and conversion authority

Add `variant_packaging_units` as a Variant-owned self-referencing hierarchy. Each row stores stable identity, optional same-Variant parent, bilingual labels, optional globally reserved operational code/barcode, exact positive `quantity_per_parent` numerator/denominator, normalized exact base-equivalent numerator/denominator, explicit sellability, base/default flags, active/archive state, and a default pricing mode (`explicit` or `derived`). A legacy/simple Variant receives one row that is root, base, sellable, default, and exactly one base unit.

Validate each Variant hierarchy as one connected deterministic graph: exactly one base unit; at least one active sellable unit; exactly one active default sale unit; at most one parent per non-root level; same-Variant edges only; and no self-link, cycle, zero/negative conversion, disconnected active node, conflicting parent, or ambiguous route to base. One transaction validates the complete proposed graph, normalizes rational values, recomputes base equivalents, and replaces/archives safely. Referenced Units cannot be semantically reparented or redefined in place.

Variant SKU remains the canonical product-configuration code. A Unit UUID always supplies commercial identity; optional Unit operational codes/barcodes support scanning, fulfillment, and external integrations without creating duplicate Products or Variants. New order snapshots store both Variant SKU and the selected Unit code where present.

Catalog exposes a narrow pricing seam containing Unit ownership/activity/sellability, default/base flags, exact conversion path, base equivalent, and default explicit/derived behavior. Feature 004 resolves Customer context and its documented priority, selects an explicit target price or nearest priced parent within the same source/context, carries exact rational conversion, rounds once half-up to the nearest EGP piastre, and calculates `rounded unit price × quantity`. Feature 003 does not calculate Customer/List-specific money. Repeated contained units may differ from one parent only by Feature 004's documented per-unit rounding remainder or an explicit Unit-level override.

### Additive data migration

Keep the already-published `supabase/migrations/003_catalog_variants_media.sql` immutable and add the follow-up `supabase/migrations/003b_catalog_packaging_units.sql`; update the Feature 003 runner to apply both in order and keep `schema.sql` convergent. Add Packaging Unit structures and nullable Unit references after existing Brand/attribute/media/Variant structures. Migrate every Variant without packaging to one one-to-one default/base/sellable Unit while preserving the existing Product/Variant backfill. Detect and report pre-existing Unit-code duplication before permanent uniqueness; never silently rewrite an operational identifier. Add nullable `order_items.sellable_unit_id` plus packaging snapshots only for new orders; retain existing Product/Variant references and snapshots. Product-level legacy fields remain a compatibility projection, with Variant/default-Unit values authoritative for new sellable flows.

Migrate cart storage client-side only when its Product has exactly one valid default Variant and that Variant has exactly one valid default Sellable Unit. Ambiguous legacy entries are removed with a clear “choose again” recovery message rather than guessed. Existing Supabase Storage URLs remain resolvable as legacy media references; only new catalog uploads use R2. A later controlled backfill may migrate legacy objects, but this feature does not require destructive bulk media migration.

### Integrity, authorization, and transaction boundaries

The migration establishes a global unique SKU constraint that includes archived Variants; active-only status never permits reuse. Optional Unit operational codes follow the same permanent-identity posture. A per-Product active-combination uniqueness strategy protects defining-attribute combinations. Server-owned catalog commands prevent publish/activation without an active Variant/default Sellable Unit, reject inactive or non-sellable Unit purchase attempts, preserve material identity for referenced Variants/Units, validate complete packaging graphs, and ensure one effective primary Product image.

Create/update/product-with-default-Variant-and-Unit, bulk reviewed Variant creation, packaging graph replacement, selected-Variant/Unit purchase validation, primary-media change, media archival, and Product/Variant/Unit archival are transactionally coordinated. Existing `requireAdmin()` protects all catalog/attribute/media/packaging mutation routes. New tables have narrow public active-catalog read policies and no customer direct mutation policies; service-role/admin commands own mutations. Customer Type remains irrelevant to Catalog conversion selection.

### R2 media architecture

Add a server-only `CatalogMediaStorage` boundary with `createUploadIntent`, `confirmUpload`, `buildPublicUrl`, and `deleteIfUnreferenced`. Implement it with Cloudflare R2’s S3-compatible API and short-lived, content-type-constrained presigned PUT URLs. Admin obtains an upload intent only after `requireAdmin`; browser uploads directly using that one-time/single-object URL and calls a server confirmation that verifies object metadata before persisting a media record. R2 secrets stay server-only. The R2 bucket CORS allowlist is restricted to approved admin origins.

Media records store provider, immutable object key, MIME type, bytes, dimensions, bilingual alt text, sort/primary state, timestamps, and archive state—not a permanent public URL. URLs are built from configured serving-base-domain logic. Production uses a Cloudflare custom domain for public cached delivery; `r2.dev` is non-production only. Object keys use stable IDs, e.g. `catalog/products/{productId}/{mediaId}.{ext}`, never display names. Archive media first; only an idempotent server maintenance command deletes the R2 object after zero remaining references. On upload/object success plus database failure, the server marks/reclaims the unassociated object; on upload failure, no media record becomes active.

### Storefront and admin integration

Replace `src/lib/data/catalog.ts` Product-only read models with Variant/Unit-aware catalog projections while retaining Product-slug URLs and one Product SEO page. Product cards show the lowest/current compatible default-Unit price and primary media. Detail projections return active Variant options, active sellable Units, deterministic defaults, specifications, Brand, ordered media, and optional Variant media. Single-valid-Variant/single-Unit UI auto-selects and hides meaningless selectors. Cart state gains `variant_id` plus `sellable_unit_id`; new order creation validates both and stores Product/Variant/SKU/Unit/conversion/base-equivalent/price/line snapshots.

Extend the existing admin Product area rather than create a second application: list/search/filter, focused Product editor sections, embedded Variant editor/generator, a visual packaging hierarchy editor, and small management areas for Brands, Categories, and Attributes. Admins set parent, exact contained quantity, bilingual label, sellability, base/default Unit, optional operational identifiers, and default explicit/derived behavior without database knowledge. All UI rules are backed by server validation. Add localized Arabic/English labels and preserve current SEO, sitemap, structured-data, analytics, payment, shipping, Customer, and approval paths.

## Implementation Sequence

1. **Catalog data foundation**: migrations, compatibility columns, default Variant backfill, permanent SKU/combinations, RLS, types, schemas, and server commands.
2. **Packaging foundation**: exact Unit hierarchy, one base/default Unit, graph validation, operational codes, one-to-one backfill, RLS, archive/replacement, and Catalog pricing/inventory contract.
3. **Compatibility and commerce identity**: catalog projections, cart Variant/Unit migration and validation, order-item Variant/Unit references and snapshots, default-Unit base-price/stock compatibility, regression tests.
4. **Media foundation**: R2 environment config/adapter, secure upload intent/confirmation, media schema, gallery/primary rules, archive/reference-safe cleanup, legacy URL provider.
5. **Admin operations**: Product list/editor, Variant generation, packaging hierarchy editor, Brand/Category/Attribute management, media gallery, search/filter, audit-compatible events.
6. **Storefront**: active catalog reads, Product detail Variant and Sellable Unit selectors, media fallback, cart additions, search/filter, SEO adaptation.
7. **Hardening**: migration validation, graph/RLS/security/cleanup tests, R2 non-production test, mobile RTL accessibility, Feature 001/002 regression, and Feature 004 seam verification.

## Exact Files / Modules Expected to Change

| Area | Existing | Planned additions/changes |
|---|---|---|
| Schema/migration | `supabase/schema.sql`, `supabase/migrations/003_catalog_variants_media.sql`, `scripts/migrate-feature-003.mjs` | Additive `supabase/migrations/003b_catalog_packaging_units.sql`, ordered Feature 003 runner update, and convergent schema/RLS/grant updates without rewriting the published base migration |
| Catalog domain | `src/lib/data/catalog.ts`, `src/lib/data/admin-crud.ts` | `src/lib/catalog/{types,validation,products,variants,packaging,attributes,brands,categories,queries}.ts` and compatible Variant/Unit query projections |
| Media | `src/app/api/admin/upload/route.ts` (Supabase legacy path) | `src/lib/catalog/media/{storage,r2,validation,cleanup}.ts`, admin upload-intent/confirm/archive routes; retain legacy provider support |
| Storefront | Product/category pages, `product-purchase-box.tsx`, `src/lib/cart.ts` | Variant and Sellable Unit selectors/gallery components, Unit-aware Product queries, cart migration/validation, localized selection/error copy |
| Orders | `src/app/api/orders/route.ts`, `src/lib/data/orders.ts`, `order_items` schema | Variant/Unit-aware validation and immutable packaging/conversion/base-equivalent snapshots |
| Admin | Product pages/form/API, sidebar, data queries | Product list/editor sections, Variant editor/generator, packaging hierarchy editor/handlers, Brand/Category/Attribute pages and handlers, R2 gallery manager |
| Configuration | `package.json`, `.env.example`, `next.config.ts` | R2 SDK/dependency, documented non-secret R2 config names, strict R2 media image patterns |
| Tests/seeds | existing Vitest suite, `scripts/migrate.mjs` | catalog/media unit+integration tests and a non-production-only reproducible demo catalog seed |

## Testing Strategy

- Database/domain: default Variant and one-to-one default/base Unit backfill, Product-to-Variant-to-Unit ownership, permanent SKU/Unit-code reservation, duplicate combination protection, active Product/Variant sellability, and archival/material-edit safety.
- Packaging: two-/three-level conversion, exact rational normalization, one base/default Unit, explicit sellability, parent ownership, graph-cycle/ambiguity/disconnection rejection, and future base-equivalent contract.
- Attributes: reusable option/numeric/text definitions, controlled values, informational specifications, canonical combination fingerprints, and stable translated display separation.
- Cart/orders: new Variant/Unit cart identity, safe single-Variant/default-Unit legacy mapping, ambiguous rejection, active/sellable validation, new Variant/SKU/Unit/conversion/base-equivalent snapshots, historical readability, and forged conversion rejection.
- Media: admin-only upload intent/confirmation, MIME/size/dimension validation, mock R2 failures, orphan recovery, primary/order integrity, Variant fallback, archive-before-cleanup, shared-reference safety, idempotent cleanup, and no credential exposure.
- Storefront/admin: active browsing/search/filter, single/multi Variant and Unit selection, packaging administration, Arabic RTL/English LTR, admin CRUD/filtering, inaccessible inactive/non-sellable records, and responsive 390 px behavior.
- Feature 004 seam: Box→Ampoule and Box→Strip→Tablet exact paths, same-context nearest-parent inputs, explicit Unit target precedence capability, and no Catalog-side Customer/List/rounding decision.
- Regression: Google auth, Customer identity/type approval, addresses, guest/authenticated checkout, order history, COD, Kashier, Bosta, Mylerz, notifications, Meta/analytics, sitemap/JSON-LD; confirm equivalent Customer Types retain identical base pricing.

## Risks, Rollback, and Boundaries

- **SKU data risk**: stop migration and report duplicate historical SKUs before permanent unique constraint; do not generate replacement values automatically.
- **Compatibility risk**: keep legacy Product fields and Supabase media URLs readable while default Variants/new R2 records become authoritative.
- **Media failure risk**: no active record until confirmation; cleanup only unreferenced archived objects; disable new uploads/UI during incident response without deleting existing objects/records.
- **Cart/order risk**: never guess a Variant or Sellable Unit for an ambiguous legacy cart item, trust client conversion/base quantity, or rewrite historical orders.
- **Provider risk**: R2 adapter confines credentials/SDK calls; R2 custom domain is configurable and strict Next image remote patterns admit only intended media paths.
- **Packaging risk**: reject the whole hierarchy on cycles, cross-Variant edges, non-positive conversion, disconnected levels, multiple bases/defaults, or ambiguous paths; referenced semantic changes use archive/replacement.
- **Future boundaries**: no Customer-Type/List price resolution, monetary derivation, quantity rules, inventory ledger, warehouse, purchasing, automatic pack consolidation, automation, or finance. Feature 004 receives stable Variant/Unit identity and exact conversions; later inventory/purchasing receive exact base equivalents.

## Project Structure

```text
specs/003-catalog-variants-media/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── catalog-api.md
└── tasks.md                       # created later by /speckit.tasks

src/
├── app/{(storefront),admin/(protected),api}/
├── components/{storefront,admin}/
├── lib/catalog/
│   ├── media/
│   └── {types,validation,products,variants,packaging,attributes,queries}.ts
├── lib/{cart,data}/
supabase/migrations/
scripts/
tests/{unit,integration}/catalog/
```

**Structure Decision**: Keep the existing single App Router application. `src/lib/catalog` becomes the intentional server/domain boundary; `src/lib/data/catalog.ts` may remain a storefront-facing facade while it is migrated to these canonical projections. R2 is an adapter, never a frontend or core-business dependency.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Transactional catalog commands | Product/Variant creation, state changes, primary media, and archival must not leave partial durable state. | Independent UI/API writes can create a sellable Product without a Variant or inconsistent gallery state. |
| R2 storage adapter and cleanup command | R2 object lifecycle must be secure, configurable, and reference-safe. | UI-level SDK calls expose credentials; immediate object deletion breaks shared media. |
| Compatibility projection during migration | Existing Product/URL/cart/order/Supabase media behavior must remain usable while Variant authority is introduced. | A destructive replacement breaks active storefront and historical paths. |
| Exact self-referencing packaging hierarchy | Arbitrary package depth must remain deterministic, category-neutral, and consumable by pricing/inventory without duplicating Variants. | Fixed Box/Strip/Tablet columns cannot represent new shapes and label/JSON-only approaches cannot enforce conversion integrity. |
