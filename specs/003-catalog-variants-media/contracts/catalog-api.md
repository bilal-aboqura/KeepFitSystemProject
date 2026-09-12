# Catalog API Contract

Same-origin App Router handlers validate all bodies, derive admin identity through `requireAdmin`, and keep R2 credentials server-only. Stable UUIDs/codes are input values; translated labels, price selection, active state, and audit actors are never browser-authoritative.

## Storefront contracts

### Catalog queries

`GET` Product/category/search views return active Product projections only: Product identity/slug, primary media URL, Brand/Category labels, active Variant options, a selected/default Variant, product specifications, and current type-neutral base-price compatibility. They do not expose archived records or Customer-Type price behavior.

### Cart/order input

New cart/order command bodies use:

```json
{ "variant_id": "uuid", "quantity": 1 }
```

The server validates Variant ownership/activity and retrieves all Product/Variant/SKU/price display snapshots itself. A legacy `{ "product_id": "uuid" }` cart entry maps only to exactly one valid default Variant; ambiguous input returns a safe recovery conflict.

## Admin catalog contracts

### `POST /api/admin/catalog/products`

Creates Product plus at least one default/defined Variant as one operation. Body supplies bilingual Product fields, Category/Brand, specifications, Variant definitions, and type-neutral base price/stock compatibility. Returns Product and Variant IDs. Rejects a publishable Product with no active Variant.

### `PATCH /api/admin/catalog/products/{productId}`

Updates Product-level content, visibility, Brand/Category, specifications, and non-identity settings. It cannot silently alter a referenced Variant’s defining attributes or SKU.

### `POST /api/admin/catalog/products/{productId}/variants`

Creates reviewed Variants with globally unique SKU, optional barcode, valid defining assignments, active state, and compatibility base price/stock. Duplicate active Product combinations return `409`.

### `PATCH /api/admin/catalog/variants/{variantId}` and archive action

Allows safe non-semantic changes; material defining-attribute changes of operationally referenced Variants return a conflict requiring archive/replacement. Archive disables new purchase while retaining identity/SKU/history.

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
- `409`: duplicate SKU/combination, stale primary/media update, unsafe referenced-Variant mutation, or ambiguous legacy cart mapping.
- `422`: invalid type, association, or media metadata.
- `503`: provider/service unavailable; no partial success is represented as complete.
