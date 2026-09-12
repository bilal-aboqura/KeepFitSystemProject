# Data Model: Catalog, Variants, Attributes & Product Media

## Ownership model

```text
Category ─┐
Brand ────┼── Product ── Product Specification
          │      ├── Product Media ─┐
          │      └── Variant ───────┼── Variant Media
          │              └── Variant Attribute Assignment
Attribute Definition ── Attribute Value ────────────┘

Cart Item / new Order Item → Variant
```

## Product

| Field/group | Rule / purpose |
|---|---|
| identity/slug | Stable Product identity and one storefront/SEO URL; slug change does not change identity. |
| bilingual content | Names, descriptions, searchable metadata, and SEO-compatible content. |
| category/brand | Category required where current catalog requires it; Brand optional reusable relation. |
| visibility | Active/archived state controls normal storefront browseability. |
| legacy compatibility | Existing SKU/price/stock/images remain transitional read compatibility; new sellable authority is Variant. |

An active sellable Product requires at least one active Variant. Archive/deactivate, rather than delete, any operationally referenced Product.

## Variant

| Field/group | Rule / purpose |
|---|---|
| `id`, `product_id` | Stable sellable identity; belongs to exactly one Product. |
| `sku` | Required for sellable Variant and globally unique forever, including archived rows. |
| `barcode` | Optional external/scanning identifier; absence never blocks creation. |
| `base_price`, `compare_at_price`, `stock` | Transitional type-neutral storefront compatibility only; future pricing/inventory replace their authority. |
| `is_active`, `archived_at` | Inactive/archived Variants cannot be newly purchased but remain historically referenced. |
| `combination_fingerprint` | Canonical fingerprint of active defining attributes, unique per Product for active Variants. |
| timestamps | Operational traceability. |

For a materially different referenced Variant, archive the old Variant and create another. Product content/Brand/Category/media edits do not alter Variant identity.

## Categories and Brands

Categories keep stable slug, bilingual labels, active state, display order, optional media, and a future-compatible nullable parent relation. Brands keep stable identity, slug/code, display name(s), optional description/logo/media, and active state. Neither is duplicated into Variant records.

## Attributes and assignments

| Entity | Key rule |
|---|---|
| Attribute Definition | Stable code, bilingual labels, `option`/`text`/`number`/`boolean` value type, optional unit, variant-defining/filterable/visible flags, ordering, active state. |
| Attribute Value | Stable reusable controlled option for option definitions, with bilingual labels/order/active state. |
| Product Specification | Product-level informational definition plus controlled or typed value; never part of a Variant combination. |
| Variant Attribute Assignment | One defining Definition/value per Variant; uses controlled value or validated typed value and feeds the fingerprint. |

The command layer verifies definition/value type compatibility, Product ownership, and a stable sorted representation for the fingerprint. Translated labels never determine identity.

## Catalog Media and references

| Field/group | Rule / purpose |
|---|---|
| identity/provider/object key | Stable media ID; provider (`r2` or legacy) and immutable object key are canonical, not public URL. |
| metadata | MIME type, bytes, dimensions, bilingual alt text, creation/archive state. |
| relationship | Product gallery and optional Variant association; a media item can be referenced safely as needed. |
| gallery | Sort order and at most one effective active primary Product image. |
| lifecycle | Archive first; active associations no longer render it; physical R2 deletion only after zero references. |

## Cart and order compatibility

New cart item: `variant_id` plus display snapshot (Product/Variant label, image, current type-neutral price). A Product-only legacy cart entry maps only if exactly one valid default Variant exists; otherwise remove with recovery feedback. New order item stores nullable `variant_id` plus SKU/Product/Variant/price/quantity snapshots. Historical rows retain existing `product_id` and snapshots unchanged.

## Access matrix

| Resource/action | Guest/customer | Admin/server |
|---|---|---|
| Active Product/Variant/Category/Brand read | Public storefront projection only | Full operational projection |
| Attributes/specifications/media read | Active customer-safe projection only | Full operational projection |
| Catalog/media/attribute mutation | Denied | Existing `requireAdmin` plus server-owned commands |
| R2 credentials/cleanup | Denied | Server-only media adapter |
| Archived/historical records | No new-purchase projection | Authorized admin/history reads |
