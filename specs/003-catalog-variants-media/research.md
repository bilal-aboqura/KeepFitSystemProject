# Research: Catalog, Variants, Attributes & Product Media

## Decision: Use an additive Product-to-Variant migration

**Rationale**: Current products carry SKU, price, stock, images, URLs, and existing cart/order dependencies. Creating one default Variant per existing Product preserves current behavior while making Variant the authority for all new commerce paths.

**Alternatives considered**: Replacing Product records or rewriting historical orders breaks URLs, snapshots, integrations, and operations. Maintaining separate simple/variant purchase paths duplicates business logic.

## Decision: Enforce globally permanent Variant SKUs

**Rationale**: The approved clarification requires a SKU to remain permanently reserved after a Variant archives. A global database uniqueness constraint keeps warehouse, reporting, purchasing, and order references unambiguous.

**Alternatives considered**: Active-only uniqueness permits dangerous reuse; UI validation races under concurrent saves; generated replacement SKUs would silently alter operational identity.

## Decision: Use normalized attribute assignment with a deterministic Variant fingerprint

**Rationale**: Definitions and controlled values need reusable identities, while numeric/text values must remain practical. Per-Product/Variant assignments plus a canonical fingerprint for defining values permit filtering, presentation, and an authoritative duplicate-combination invariant without columns per property.

**Alternatives considered**: One JSON blob is weaker for validation/filtering; one column per attribute requires recurring schema changes; forcing all numeric values into global options creates unnecessary administration.

## Decision: Keep Product specifications separate from Variant-defining attributes

**Rationale**: Product facts such as Form and country of origin must not produce sellable combinations. Explicit product specifications avoid accidental Cartesian Variant generation.

**Alternatives considered**: Treating every attribute as Variant-defining creates invalid/unnecessary combinations and confusing customer UI.

## Decision: Make Sellable Unit a stable Variant-owned identity

**Rationale**: A Variant identifies the product configuration, while Box, Strip, Ampoule, Tablet, Bottle, and similar levels identify different commercial quantities of that same Variant. Stable Sellable Unit identity lets cart, orders, pricing, and later inventory distinguish three Boxes from three Ampoules without creating duplicate Products or Variants.

**Alternatives considered**: Encoding the unit in free-form labels makes requests and history ambiguous. Creating one Variant per package level corrupts the Variant/attribute model and duplicates product identity. Treating every contained level as sellable ignores explicit business policy.

## Decision: Model one deterministic exact packaging hierarchy per Variant

**Rationale**: A Variant-owned parent chain with one canonical base unit, one parent per contained level, and exact positive rational conversions represents arbitrary depth without category-specific columns. Normalized base equivalents support future inventory/purchasing while a full authoritative graph validation rejects cycles, self-links, cross-Variant edges, disconnected levels, and ambiguous paths.

**Alternatives considered**: Category-specific Box/Strip/Tablet columns require recurring schema changes. Floating-point conversion risks inconsistent totals. Unvalidated generic graphs permit ambiguous conversion and historical reinterpretation. Description-only quantities cannot be authoritative.

## Decision: Keep Variant SKU canonical and allow optional unit operational codes

**Rationale**: Variant remains the canonical product configuration and owns the permanent SKU. Each packaging level has a stable UUID and may carry a distinct immutable operational code or barcode when picking, scanning, or external systems require it. Orders snapshot both identities; no duplicate Product or Variant is invented for packaging.

**Alternatives considered**: Reusing one SKU as the only unit identity cannot distinguish package levels operationally. Requiring a full SKU for every non-sellable level creates unnecessary identifiers. Replacing the Variant SKU with unit codes breaks the approved Variant contract.

## Decision: Feature 003 owns conversion facts; Feature 004 owns monetary derivation

**Rationale**: Catalog is authoritative for Variant/Unit ownership, sellability, default/base units, exact conversion paths, and pricing-behavior hints. The Pricing Engine is authoritative for Customer context, explicit price precedence, nearest-parent price selection within that same context, exact-rational calculation, monetary rounding, and line totals. This prevents Retail prices from leaking into Wholesale derivation and keeps browser inputs non-authoritative.

**Alternatives considered**: Calculating derived money in Catalog duplicates Feature 004 and cannot honor Customer/List context. Letting the browser divide package prices creates inconsistent rounding and price manipulation. Storing one universal derived price is invalid when Customer contexts differ.

## Decision: Use R2 S3-compatible presigned PUT uploads with server confirmation

**Rationale**: Cloudflare R2 supports server-generated, time-limited presigned PUT URLs with content-type constraints; the server can authorize the Admin, generate a stable key, then verify and persist the media record after upload. This avoids streaming large files through the application and never exposes permanent credentials. [Cloudflare R2 presigned URL docs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)

**Alternatives considered**: Browser R2 SDK access exposes credentials. Server-proxy uploads are acceptable for small files but consume application resources and are less suitable for gallery uploads. Supabase Storage remains only a legacy-read compatibility provider.

## Decision: Store R2 object keys, build public URLs from configuration, and use a custom domain in production

**Rationale**: R2 buckets are private by default; a custom domain enables production cache/security controls. Persisting provider/object key lets the serving hostname change without rewriting catalog rows. `r2.dev` is rate-limited and intended for non-production. [Cloudflare public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), [R2 cache guidance](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)

**Alternatives considered**: Storing only public URLs couples records to a hostname. Production `r2.dev` URLs lack the required production cache/security properties.

## Decision: Archive media before idempotent reference-safe cleanup

**Rationale**: The approved clarification protects shared Product/Variant media. Archival removes an object from active rendering immediately; a later cleanup command can delete only zero-reference objects and can safely retry.

**Alternatives considered**: Immediate physical deletion breaks shared references. Retaining every removed object indefinitely accumulates avoidable storage cost and operational clutter.

## Decision: Restrict remote images with explicit Next.js patterns

**Rationale**: Next.js 16 recommends precise `images.remotePatterns` for remote image optimization; dimensions stored on media records prevent layout shift. [Next.js Image documentation](https://nextjs.org/docs/app/api-reference/components/image)

**Alternatives considered**: Broad host/domain allowlists admit unintended remote media; arbitrary URLs prevent dependable optimization policy.

## Decision: Preserve Product-slug URLs and a single Product SEO page

**Rationale**: Products remain catalog/SEO concepts while Variants are selected within the detail page. This preserves existing sitemap, OpenGraph, and JSON-LD paths and avoids duplicate Variant pages.

**Alternatives considered**: Variant routes create duplicate SEO surfaces without a stated customer need. Renaming/redirecting all Product URLs is unrelated migration risk.

## Sources

- Current Product/catalog/cart/order/upload implementation: `src/lib/data/catalog.ts`, `src/lib/cart.ts`, `src/app/api/orders/route.ts`, `src/app/api/admin/upload/route.ts`
- Current schema and Feature 001 migration model: `supabase/schema.sql`, `supabase/migrations/001_customer_identity.sql`
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare R2 public/custom domain guidance](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Next.js Image remote patterns](https://nextjs.org/docs/app/api-reference/components/image)
