# Implementation Plan: Catalog, Variants, Attributes & Product Media

**Branch**: `003-catalog-variants-media` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)
**Input**: Approved Feature 003 specification, SKU/media clarification decisions, constitution, Feature 001/002 foundations, current repository, and supplied technical direction.

## Summary

Evolve the current Product-level catalog into one modular-monolith Catalog domain: Product remains the browseable concept and Variant becomes the canonical sellable unit. Add persistent Brands, extensible attribute definitions/values, Product specifications, Variant attribute assignments, globally permanent SKUs, catalog media records, and R2-backed new media. Migrate existing Products additively to one default Variant, preserve product URLs/historical snapshots/legacy Supabase media, move new cart and order lines to Variant identity, and retain a type-neutral base-price/stock compatibility projection until Features 004 and later inventory work.

## Technical Context

**Language/Version**: TypeScript, Next.js 16.2.9, React 19.2.4  
**Primary Dependencies**: Supabase JS/SSR, Supabase PostgreSQL/Auth, Zod, Vitest; add AWS S3-compatible client/presigner packages for R2 server-only access  
**Storage**: Supabase PostgreSQL for catalog state; Cloudflare R2 for all new catalog media; existing Supabase Storage only for legacy media compatibility  
**Testing**: Vitest unit/integration tests, `npm run lint`, `npm run build`, mocked R2 tests, controlled non-production R2 smoke test, manual Arabic RTL/mobile validation  
**Target Platform**: Responsive web, Arabic RTL-first/English LTR, approximately 390 px mobile viewport  
**Project Type**: Existing Next.js App Router modular-monolith web application  
**Performance Goals**: Catalog listing/detail and selected-Variant state usable within 2 seconds on a normal mobile connection; admin media feedback is immediate and never falsely reports success  
**Constraints**: Variant is the sellable authority; SKU is globally unique forever; no customer-type pricing or inventory ledger; R2 credentials are server-only; inactive Variants cannot be newly purchased  
**Scale/Scope**: One application/database; initial demo catalog of five product shapes; R2 uses isolated non-production/production configuration and a configurable custom serving domain

## Constitution Check

*GATE: Passed before research and re-checked after design.*

- [x] Extends the existing Next.js/Supabase modular monolith and does not create a parallel catalog, service, or database.
- [x] Makes Variant the catalog’s sellable/operational source of truth while Products retain catalog/SEO identity.
- [x] Keeps all prices type-neutral and establishes no price-list, Customer-Type, or quantity pricing behavior.
- [x] Places SKU, combination, publishability, media-primary, archival, and purchase eligibility rules in authoritative server/database boundaries.
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
             │                                  │
attribute_definitions ──→ attribute_values ─────┘

new cart_items/order_items → product_variants
historical order_items → existing product/snapshot fields (preserved)
```

`products.id` remains the Product/SEO identity. `product_variants.id` becomes the only new sellable identity and owns SKU, optional barcode, base compatibility price, current stock compatibility, active/archive state, and a deterministic defining-attribute fingerprint. Product-level specifications never enter the Variant fingerprint. Feature 004 consumes `(Customer, Variant)`, and later inventory consumes `variant_id`.

### Additive data migration

Create `supabase/migrations/003_catalog_variants_media.sql`, a dedicated Feature 003 runner, and convergent `schema.sql` definitions. Add Brands/attribute/media/Variant structures and nullable Variant references first. Migrate every existing Product to one default Variant, copying legacy `products.sku`, `price`, `compare_at_price`, `stock`, active state, and compatible display context. Detect and report pre-existing SKU duplication before applying permanent uniqueness; never silently rewrite a SKU. Add `order_items.variant_id` only for new orders; retain existing Product references and snapshots. Retain Product-level legacy fields as a compatibility projection through Feature 003, with Variant values authoritative for new sellable flows.

Migrate cart storage client-side only when its Product has exactly one valid default Variant. Ambiguous legacy entries are removed with a clear “choose again” recovery message rather than guessed. Existing Supabase Storage URLs remain resolvable as legacy media references; only new catalog uploads use R2. A later controlled backfill may migrate legacy objects, but this feature does not require destructive bulk media migration.

### Integrity, authorization, and transaction boundaries

The migration establishes a global unique SKU constraint that includes archived Variants; active-only status never permits reuse. A per-Product active-combination uniqueness strategy protects defining-attribute combinations. Server-owned catalog commands prevent publish/activation of a sellable Product without an active Variant, reject inactive Variant purchase attempts, preserve material identity for operationally referenced Variants, and ensure one effective primary Product image.

Create/update/product-with-default-Variant, bulk reviewed Variant creation, selected-Variant purchase validation, primary-media change, media archival, and Product/Variant archival are transactionally coordinated. Existing `requireAdmin()` protects all catalog/attribute/media mutation routes. New tables have narrow public active-catalog read policies and no customer direct mutation policies; service-role/admin commands own mutations. Customer Type remains irrelevant to catalog price selection.

### R2 media architecture

Add a server-only `CatalogMediaStorage` boundary with `createUploadIntent`, `confirmUpload`, `buildPublicUrl`, and `deleteIfUnreferenced`. Implement it with Cloudflare R2’s S3-compatible API and short-lived, content-type-constrained presigned PUT URLs. Admin obtains an upload intent only after `requireAdmin`; browser uploads directly using that one-time/single-object URL and calls a server confirmation that verifies object metadata before persisting a media record. R2 secrets stay server-only. The R2 bucket CORS allowlist is restricted to approved admin origins.

Media records store provider, immutable object key, MIME type, bytes, dimensions, bilingual alt text, sort/primary state, timestamps, and archive state—not a permanent public URL. URLs are built from configured serving-base-domain logic. Production uses a Cloudflare custom domain for public cached delivery; `r2.dev` is non-production only. Object keys use stable IDs, e.g. `catalog/products/{productId}/{mediaId}.{ext}`, never display names. Archive media first; only an idempotent server maintenance command deletes the R2 object after zero remaining references. On upload/object success plus database failure, the server marks/reclaims the unassociated object; on upload failure, no media record becomes active.

### Storefront and admin integration

Replace `src/lib/data/catalog.ts` Product-only read models with Variant-aware catalog projections while retaining Product-slug URLs and one Product SEO page. Product cards show the lowest/current compatible base price and primary media. Detail projections return active Variant option groups, deterministic selection data, product specifications, Brand, ordered Product media, and optional Variant media. Single-valid-Variant UI auto-selects and hides selectors. Cart state gains `variant_id`, uses Variant snapshots for display, and preserves only safe legacy migration behavior. New order creation validates selected active Variants and writes `order_items.variant_id` plus product/Variant/SKU/price snapshots.

Extend the existing admin Product area rather than create a second application: list/search/filter, focused Product editor sections, embedded Variant editor/generator, and small management areas for Brands, Categories, and Attributes. All UI rules are backed by server validation. Add localized Arabic/English labels and preserve current SEO, sitemap, structured-data, analytics, payment, shipping, Customer, and approval paths.

## Implementation Sequence

1. **Catalog data foundation**: migrations, compatibility columns, default Variant backfill, permanent SKU/combinations, RLS, types, schemas, and server commands.
2. **Compatibility and commerce identity**: catalog query projections, cart Variant migration/validation, order-item Variant reference/snapshots, current base-price/stock compatibility, regression tests.
3. **Media foundation**: R2 environment config/adapter, secure upload intent/confirmation, media schema, gallery/primary rules, archive/reference-safe cleanup, legacy URL provider.
4. **Admin operations**: Product list/editor, Variant management/generation, Brand/Category/Attribute management, media gallery, search/filter, audit-compatible events.
5. **Storefront**: active catalog reads, Product detail Variant resolver/selectors, media fallback, cart additions, search/filter, SEO adaptation.
6. **Hardening**: migration validation, RLS/security/cleanup tests, R2 non-production test, mobile RTL accessibility, Feature 001/002/integration regression, and pricing-neutral verification.

## Exact Files / Modules Expected to Change

| Area | Existing | Planned additions/changes |
|---|---|---|
| Schema/migration | `supabase/schema.sql`, `supabase/migrations/001_customer_identity.sql`, `scripts/migrate-feature-001.mjs` | `supabase/migrations/003_catalog_variants_media.sql`, `scripts/migrate-feature-003.mjs`, convergent schema and RLS/grant updates |
| Catalog domain | `src/lib/data/catalog.ts`, `src/lib/data/admin-crud.ts` | `src/lib/catalog/{types,validation,products,variants,attributes,brands,categories,queries}.ts` and compatible query projections |
| Media | `src/app/api/admin/upload/route.ts` (Supabase legacy path) | `src/lib/catalog/media/{storage,r2,validation,cleanup}.ts`, admin upload-intent/confirm/archive routes; retain legacy provider support |
| Storefront | Product/category pages, `product-purchase-box.tsx`, `src/lib/cart.ts` | Variant selector/gallery components, Variant-aware Product queries, cart migration/validation, localized selection/error copy |
| Orders | `src/app/api/orders/route.ts`, `src/lib/data/orders.ts`, `order_items` schema | Variant-aware server validation and new order snapshots/reference |
| Admin | Product pages/form/API, sidebar, data queries | Product list/editor sections, Variant editor/generator, Brand/Category/Attribute pages and handlers, R2 gallery manager |
| Configuration | `package.json`, `.env.example`, `next.config.ts` | R2 SDK/dependency, documented non-secret R2 config names, strict R2 media image patterns |
| Tests/seeds | existing Vitest suite, `scripts/migrate.mjs` | catalog/media unit+integration tests and a non-production-only reproducible demo catalog seed |

## Testing Strategy

- Database/domain: default Variant backfill, Product-to-Variant ownership, permanent SKU reservation, duplicate combination protection, active Product requires active Variant, inactive purchase denial, and archival/material-edit safety.
- Attributes: reusable option/numeric/text definitions, controlled values, informational specifications, canonical combination fingerprints, and stable translated display separation.
- Cart/orders: new Variant cart identity, safe single-Variant legacy mapping, ambiguous rejection, active-Variant validation, new Variant/SKU snapshots, historical order readability.
- Media: admin-only upload intent/confirmation, MIME/size/dimension validation, mock R2 failures, orphan recovery, primary/order integrity, Variant fallback, archive-before-cleanup, shared-reference safety, idempotent cleanup, and no credential exposure.
- Storefront/admin: active browsing/search/filter, single/multi Variant selection, Arabic RTL/English LTR, admin CRUD/filtering, inaccessible inactive records, and responsive 390 px behavior.
- Regression: Google auth, Customer identity/type approval, addresses, guest/authenticated checkout, order history, COD, Kashier, Bosta, Mylerz, notifications, Meta/analytics, sitemap/JSON-LD; confirm equivalent Customer Types retain identical base pricing.

## Risks, Rollback, and Boundaries

- **SKU data risk**: stop migration and report duplicate historical SKUs before permanent unique constraint; do not generate replacement values automatically.
- **Compatibility risk**: keep legacy Product fields and Supabase media URLs readable while default Variants/new R2 records become authoritative.
- **Media failure risk**: no active record until confirmation; cleanup only unreferenced archived objects; disable new uploads/UI during incident response without deleting existing objects/records.
- **Cart/order risk**: never guess a Variant for an ambiguous legacy cart item or rewrite historical orders.
- **Provider risk**: R2 adapter confines credentials/SDK calls; R2 custom domain is configurable and strict Next image remote patterns admit only intended media paths.
- **Future boundaries**: no Customer-Type pricing, price lists, quantity rules, inventory ledger, warehouse, purchasing, automation, or finance. Feature 004 receives a stable Variant identity; later inventory receives `variant_id`.

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
│   └── {types,validation,products,variants,attributes,queries}.ts
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
