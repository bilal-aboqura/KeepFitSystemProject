# Data Model: Catalog, Variants, Packaging, Attributes & Product Media

## Ownership model

```text
Category ─┐
Brand ────┼── Product ── Product Specification
          │      ├── Product Media ─┐
          │      └── Variant ───────┼── Variant Media
          │              ├── Variant Attribute Assignment
          │              └── Packaging / Sellable Unit ── parent conversion
Attribute Definition ── Attribute Value ────────────┘

Cart Item / new Order Item → Variant + Sellable Unit
```

## Product

| Field/group | Rule / purpose |
|---|---|
| identity/slug | Stable Product identity and one storefront/SEO URL; slug change does not change identity. |
| bilingual content | Names, descriptions, searchable metadata, and SEO-compatible content. |
| category/brand | Category required where current catalog requires it; Brand optional reusable relation. |
| visibility | Active/archived state controls normal storefront browseability. |
| legacy compatibility | Existing SKU/price/stock/images remain transitional read compatibility; Variant is the canonical configuration and its default Sellable Unit is the orderable packaging identity. |

An active sellable Product requires at least one active Variant. Archive/deactivate, rather than delete, any operationally referenced Product.

## Variant

| Field/group | Rule / purpose |
|---|---|
| `id`, `product_id` | Stable sellable identity; belongs to exactly one Product. |
| `sku` | Required for sellable Variant and globally unique forever, including archived rows. |
| `barcode` | Optional external/scanning identifier; absence never blocks creation. |
| `base_price`, `compare_at_price`, `stock` | Transitional type-neutral default-unit storefront compatibility only; future pricing/inventory replace their authority. |
| `is_active`, `archived_at` | Inactive/archived Variants cannot be newly purchased but remain historically referenced. |
| `combination_fingerprint` | Canonical fingerprint of active defining attributes, unique per Product for active Variants. |
| timestamps | Operational traceability. |

For a materially different referenced Variant, archive the old Variant and create another. Product content/Brand/Category/media edits do not alter Variant identity.

## Packaging / Sellable Unit

Each Variant owns one connected, deterministic packaging hierarchy. A simple Variant still has one unit that is simultaneously root, base, sellable, and default with a one-to-one conversion.

| Field/group | Rule / purpose |
|---|---|
| `id`, `variant_id` | Stable unit identity belonging to exactly one Variant; never inferred from a label. |
| `parent_unit_id` | Optional immediate containing unit in the same Variant. A non-root unit has at most one parent. |
| `code`, `barcode` | Optional operational unit identifiers. They supplement but do not replace the Variant SKU or create another Variant/Product. Reuse follows permanent operational-identity safety. |
| bilingual labels | Human-readable packaging names such as Box/Ampoule or their Arabic equivalents; label changes do not change identity. |
| `quantity_per_parent_numerator`, `quantity_per_parent_denominator` | Exact positive rational count of this unit within one immediate parent; root uses one-to-one semantics. No floating-point authority. |
| `base_quantity_numerator`, `base_quantity_denominator` | Exact normalized quantity of the Variant's canonical base unit represented by one unit at this level. Base unit is exactly one. |
| `is_base_unit` | Exactly one active unit per Variant. Every active level must resolve to it through one unambiguous path. |
| `is_sellable` | Explicit business permission; hierarchy position and containment never imply sale eligibility. |
| `is_default_sale_unit` | Exactly one active default among active sellable units for an active Variant. |
| `default_price_mode` | `explicit` or `derived` default behavior exposed to Feature 004; context-specific explicit overrides may still win there. |
| `is_active`, `archived_at` | Inactive/archived/non-sellable levels cannot enter new carts/orders but remain historically identifiable. |
| timestamps | Operational traceability. |

### Conversion invariants

- Parent and child always belong to the same Variant.
- Conversion numerator and denominator are positive and normalized; zero or negative conversions are invalid.
- Self-parenting, cycles, disconnected active units, multiple parents, and multiple/ambiguous routes to the base unit are invalid.
- An active Variant has exactly one base unit, at least one sellable unit, and exactly one default active sellable unit.
- Structural changes that would reinterpret an operationally referenced unit require archive/replacement.
- The authoritative command recomputes the complete hierarchy and normalized base equivalents atomically before accepting any graph change.

### Pricing and future inventory contract

Catalog exposes Variant/Unit ownership, activity, sellability, default status, exact parent path, and exact base equivalent. Feature 004 resolves the Customer/Price List context, chooses an explicit target price or the nearest priced parent in that same context, carries the exact conversion rational, rounds once under its monetary policy, and calculates the line total. Future inventory and purchasing consume the exact base equivalent but do not mutate Catalog conversion facts.

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

New cart item: `variant_id`, `sellable_unit_id`, quantity, plus disposable display snapshots (Product/Variant/unit labels, image, current price). A Product-only legacy cart entry maps only if exactly one valid default Variant and default Sellable Unit exist; otherwise remove with recovery feedback.

New order item stores nullable `variant_id` and `sellable_unit_id` plus immutable Variant SKU, optional unit code, Product/Variant/unit bilingual labels, sold quantity, exact units per sold package, exact equivalent base quantity, accepted unit price, and line total snapshots. Historical rows retain existing `product_id` and snapshots unchanged. Later packaging edits never recalculate old order meaning.

## Access matrix

| Resource/action | Guest/customer | Admin/server |
|---|---|---|
| Active Product/Variant/Sellable Unit/Category/Brand read | Public storefront projection only; only active sellable units | Full operational projection |
| Attributes/specifications/media read | Active customer-safe projection only | Full operational projection |
| Catalog/packaging/media/attribute mutation | Denied | Existing `requireAdmin` plus server-owned commands |
| R2 credentials/cleanup | Denied | Server-only media adapter |
| Archived/historical records | No new-purchase projection | Authorized admin/history reads |
