# Admin Operations API Contract

Every endpoint requires the existing `requireAdminUser()`/`requireAdmin()` check before any service-role operation. Hiding navigation is never authorization. Bodies and query strings are schema-validated; errors expose stable codes rather than database text.

## Quantity-rule operations

### `GET /api/admin/commerce/quantity-rules`

Query parameters:

- `contextKind=public|customer_type`
- `customerTypeId`, `productId`, `variantId`, `sellableUnitId`
- `status=active|inactive|archived|all`
- `query` for Product/Variant/SKU/Unit labels
- `cursor`, `limit` (bounded, default 50)

Result includes rule ID/context, Customer Type label when applicable, Product/Variant/SKU/Unit identity, minimum/increment, active/archive state, updated time, and cursor. It does not calculate a historical order against current rules.

### `PUT /api/admin/commerce/quantity-rules`

Atomically sets or replaces the sole active rule for a complete context.

```json
{
  "context": { "kind": "customer_type", "customerTypeId": "uuid" },
  "variantId": "uuid",
  "sellableUnitId": "uuid",
  "minimumQuantity": 6,
  "quantityIncrement": 2,
  "reason": "Wholesale case order"
}
```

Public context is `{ "kind": "public" }` and must not carry a Customer Type. The command validates positive integers, Unit → Variant ownership, active entities, and Admin authorization; locks the context; changes/deactivates the previous active row; appends audit; and commits with exactly one active rule.

Success returns `200` with the active rule and audit correlation ID. `409 QUANTITY_RULE_CONFLICT` represents a concurrency/version conflict after safe retry; `422 QUANTITY_RULE_INVALID` represents invalid context or target.

### `DELETE /api/admin/commerce/quantity-rules/{ruleId}`

Deactivates/archives the rule with a required bounded reason. It does not delete history. Resolution then uses the 1/1 fallback until another rule is configured.

## Admin dashboard query contract

`getAdminOperationalDashboard()` is an internal server service used by `/admin`; no browser mutation API is required.

```text
attention
  pendingCustomerTypeRequests
  pendingFulfillmentOrders   // fulfillment_status = pending, all ages
  variantsWithoutSellableUnits
  sellableUnitsWithoutPrice
  invalidQuantityRuleConfigurations
summary
  customers
  activeProducts
  activeVariants
  orders
  safelySupportedOrderValue
recentOrders[]
```

Each attention item contains a count, severity, bilingual label key, and destination with the corresponding server-side filter. Counts come from current data and never from read/unread state.

## Admin Orders list

### `GET /api/admin/orders`

Extends the existing list contract to server pagination.

Query parameters:

- `query`: order number, Customer snapshot name, main/alternate phone, or SKU
- `fulfillmentStatus`, `paymentStatus`, `paymentMethod`
- `customerType`: snapshot code or `public`
- `createdFrom`, `createdTo`: ISO-8601 boundaries
- `cursor`, `limit` (bounded, default 50)

Result row:

```json
{
  "id": "uuid",
  "orderNumber": "KF-ABC123-260913",
  "createdAt": "ISO-8601",
  "customer": {
    "kind": "customer",
    "customerId": "uuid",
    "name": "Snapshot Name",
    "phone": "010...",
    "customerType": { "code": "wholesale", "label": "Wholesale Trader" }
  },
  "totalMinor": "65000",
  "currency": "EGP",
  "paymentMethod": "cod",
  "paymentStatus": "pending",
  "fulfillmentStatus": "pending",
  "shippingSummary": null
}
```

Guest rows use `{ "kind": "guest", "customerId": null, ... }`. Legacy rows may expose `snapshotCompleteness = legacy`; no type is inferred from phone or current Customer data.

### Admin order detail

The existing `/admin/orders/{id}` page consumes a server-only detail service. The detail DTO includes:

- immutable Customer/guest and address snapshots;
- Product, Variant, SKU, selected Sellable Unit, base equivalent, quantity;
- authoritative unit/line minor amounts and compatibility display amounts;
- quantity-rule minimum/increment/context snapshot;
- discount components, shipping policy/match, totals, currency;
- payment method/status, existing fulfillment status, provider state;
- safe pricing source kind/derived indicator and persistent Customer link where present;
- `snapshotCompleteness = authoritative_v1 | legacy`.

Protected source references remain trusted-only and are not copied to Customer order DTOs.

## Mutation compatibility boundary

- Existing notes, payment-status, fulfillment-status, and carrier operations continue under current Admin authorization until their owning feature replaces them.
- `admin_replace_order_items` and `/api/admin/orders/{id}/items` must reject `commerce_snapshot_version >= 1`. Only legacy rows may retain the current compatibility editor.
- Feature 005 adds no free-text statuses, lifecycle transitions, post-order repricing, or recalculation.
- Feature 006 owns controlled order status transitions; Feature 008 owns controlled item editing.

## Configuration warnings

Admin-safe diagnostics expose only reliably detectable blockers:

| Code | Definition | Destination |
|---|---|---|
| `VARIANT_NO_SELLABLE_UNIT` | Active Variant has no active independently sellable Unit. | Catalog Variant/Unit editor |
| `UNIT_PRICE_UNAVAILABLE` | Active independently sellable Unit has no current Feature 004 price in a required operational context. | Pricing diagnostics/configuration |
| `QUANTITY_RULE_INVALID` | Stored rule violates target/context expectations or migration checks. | Quantity-rule manager |

Absence of an explicit quantity rule is not a blocker because 1/1 is valid fallback.

## Audit and diagnostics

Quantity mutations return a correlation ID and append actor, action, context/target, before/after, reason, and time. Checkout/order failures may be summarized for Admin using safe codes and counts, but this feature does not expose raw Customer payloads or build the full Feature 022 audit console.
