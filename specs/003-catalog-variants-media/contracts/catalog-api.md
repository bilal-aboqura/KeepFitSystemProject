# Catalog API Contract

Same-origin App Router handlers validate all bodies, derive admin identity through `requireAdmin`, and keep R2 credentials server-only. Stable Variant/Sellable Unit UUIDs and permitted quantities are inputs; translated labels, conversions, base equivalents, prices, active/sellable state, and audit actors are never browser-authoritative.

## Storefront contracts

### Catalog queries

`GET` Product/category/search views return active Product projections only: Product identity/slug, primary media URL, Brand/Category labels, active Variant options, active sellable packaging Units, selected/default Variant and Unit, Product specifications, exact customer-safe conversion/base-equivalent facts needed for display, and current type-neutral default-price compatibility. They do not expose archived/non-sellable records or Customer-Type price behavior.

### Cart/order input

New cart/order command bodies use:

```json
{ "variant_id": "uuid", "sellable_unit_id": "uuid", "quantity": 3 }
```

The server validates Variant/Unit ownership, activity, sellability, default state, and exact conversion/base equivalent, then retrieves Product/Variant/SKU/Unit/price display snapshots itself. Client conversion, units-per-package, derived price, and base-equivalent fields are rejected or ignored as authority. A legacy `{ "product_id": "uuid" }` cart entry maps only to exactly one valid default Variant and default Sellable Unit; ambiguous input returns a safe recovery conflict.

## Admin catalog contracts

### `POST /api/admin/catalog/products`

Creates Product plus at least one default/defined Variant as one operation. Body supplies bilingual Product fields, Category/Brand, specifications, Variant definitions, and type-neutral base price/stock compatibility. Returns Product and Variant IDs. Rejects a publishable Product with no active Variant.

### `PATCH /api/admin/catalog/products/{productId}`

Updates Product-level content, visibility, Brand/Category, specifications, and non-identity settings. It cannot silently alter a referenced Variant’s defining attributes or SKU.

### `POST /api/admin/catalog/products/{productId}/variants`

Creates reviewed Variants with globally unique SKU, optional barcode, valid defining assignments, active state, compatibility base price/stock, and one one-to-one default/base/sellable Unit unless a complete packaging hierarchy is supplied. Duplicate active Product combinations return `409`.

### `PATCH /api/admin/catalog/variants/{variantId}` and archive action

Allows safe non-semantic changes; material defining-attribute changes of operationally referenced Variants return a conflict requiring archive/replacement. Archive disables new purchase while retaining identity/SKU/history.

### `GET /api/admin/catalog/variants/{variantId}/packaging`

Returns the full authorized packaging hierarchy: stable Unit IDs, same-Variant parent IDs, bilingual labels, optional operational codes/barcodes, exact quantity-per-parent and base-equivalent fractions, sellable/base/default flags, default pricing mode, active/archive state, and reference/change-safety status.

### `PUT /api/admin/catalog/variants/{variantId}/packaging`

Atomically replaces the proposed active hierarchy after validating same-Variant ownership, exact positive conversions, one parent per non-root Unit, one connected acyclic path to one base Unit, at least one sellable Unit, exactly one default active sellable Unit, permanent operational-code uniqueness, and referenced-Unit archive/replacement safety. Returns normalized hierarchy and base equivalents. Any invalid node/edge rejects the whole change.

### `POST /api/admin/catalog/packaging-units/{unitId}/archive`

Archives an unneeded Unit without deleting historical identity. Refuses removal when it would invalidate the Variant hierarchy, remove its only sellable/default/base Unit, disconnect descendants, or reinterpret referenced history without an approved replacement.

## Catalog integration contract

Feature 004 and later authorized server modules may resolve one active target by `(variant_id, sellable_unit_id)` and receive ownership, sellability, default/base flags, bilingual labels, Variant SKU, optional Unit code, exact normalized parent path, and exact base-equivalent fraction. Catalog never accepts Customer/List context and never returns a Customer-specific amount. Feature 004 applies its own same-context explicit/nearest-parent-derived priority and rounding policy.

### Brand, Category, Attribute management

Admin-only list/create/update/archive handlers manage reusable entities. Attribute-definition changes validate existing assignments and cannot invalidate current Variants silently.

## Admin media contracts

### `POST /api/admin/catalog/media/upload-intents`

Admin-only. Validates intended Product/Variant context, supported MIME, requested size/dimensions, and produces an immutable object key plus a short-lived, content-type-bound R2 PUT URL. Response contains no R2 credential.

### `POST /api/admin/catalog/media/confirm`

Admin-only. Verifies uploaded-object metadata, creates the catalog media record/association, and applies sort/primary rules atomically. Failure returns a safe error and schedules/marks the object for cleanup rather than reporting success.

### `PATCH /api/admin/catalog/media/{mediaId}` / archive action

Admin-only. Reorders gallery/set-primary or archives the record. Archival removes active rendering immediately; R2 deletion is performed only by an idempotent server maintenance command after a zero-reference check.

## Error behavior

- `401`/`403`: authentication or admin authorization failure.
- `404`: no accessible resource.
- `409`: duplicate SKU/Unit code/combination, invalid concurrent hierarchy state, stale primary/media update, unsafe referenced Variant/Unit mutation, or ambiguous legacy cart mapping.
- `422`: invalid type, association, media metadata, non-positive conversion, cycle, cross-Variant edge, disconnected hierarchy, multiple base/default Units, non-sellable selection, or ambiguous conversion path.
- `503`: provider/service unavailable; no partial success is represented as complete.
