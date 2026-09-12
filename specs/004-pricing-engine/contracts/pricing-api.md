# Pricing API Contract

All interfaces are same-origin App Router handlers or equivalent Server Actions. Bodies use Zod validation. Browser-provided monetary values, Customer IDs/types/Lists, and timestamps are never price authority.

## Current-context pricing projection

Catalog reads batch-resolve active Variant/Sellable Unit targets for the current session context. A safe target result is:

```json
{
  "variantId": "uuid",
  "sellableUnitId": "uuid",
  "availability": "priced",
  "amountMinor": "10000",
  "currency": "EGP",
  "displayAmount": "100.00",
  "isDerived": true
}
```

An unavailable target returns an availability code instead of monetary fields. It never exposes List IDs/names, override IDs, alternative tiers, trace, or another Customer's data.

## `POST /api/pricing/reprice`

Guest/authenticated cart repricing accepts only canonical targets and quantity:

```json
{
  "items": [
    { "variant_id": "uuid", "sellable_unit_id": "uuid", "quantity": 2 }
  ]
}
```

The server derives authenticated Customer context, resolves each deduplicated target in batch, and returns authoritative safe unit/line amounts, currency, availability, and non-sensitive `changed` state. It rejects invalid/duplicate-invalid IDs, non-positive quantity, inactive/non-sellable targets, and no-price outcomes. It accepts no `price`, totals, Customer identity/type/list, or client timestamp.

## `POST /api/orders` change

Retain contact/address/payment/discount data, but replace line authority with:

```json
{
  "items": [
    { "variant_id": "uuid", "sellable_unit_id": "uuid", "quantity": 2 }
  ]
}
```

The server fetches labels/images/SKU, invokes the resolver, calculates line/subtotal amounts, applies existing supported shipping/coupon/card-discount behavior after unit pricing, and writes order/snapshots atomically. Transitional Product IDs, prices, names, images, client subtotal, and grand total are ignored, then rejected after cutover. `409 PRICE_CHANGED` returns safe current reprice data; `409 PRICE_UNAVAILABLE` returns target-safe availability; `422` represents malformed input. Failed resolution produces no order or payment redirect.

## Admin-only commands

All require `requireAdminUser()` before server/service access. Meaningful results include target ID, version/concurrency state where useful, and audit correlation ID.

| Contract | Purpose |
|---|---|
| `GET/POST /api/admin/pricing/lists` | List/create Lists with code, localized labels, currency and activity. |
| `GET/PATCH /api/admin/pricing/lists/{id}` | Detail/edit/archive without invalidating default configuration. |
| `GET/PUT /api/admin/pricing/lists/{id}/items` | Filtered price grid plus all-or-nothing bulk Variant/Unit explicit-price save. |
| `POST /api/admin/pricing/lists/{id}/items/schedule` | Future price creation, optionally closing prior open period; overlap returns `409`. |
| `PUT /api/admin/pricing/default` | Atomically set the one default active List. |
| `GET/PUT /api/admin/pricing/customer-type-mappings` | Read/set/clear effective Customer Type mappings. |
| `PUT/DELETE /api/admin/customers/{customerId}/price-list` | Set/remove direct List without changing Customer Type. |
| `GET/POST/PATCH /api/admin/customers/{customerId}/price-overrides` | Maintain Variant/Unit override, interval/lifecycle and reason. |
| `POST /api/admin/pricing/diagnostics/resolve` | Read-only production-resolver trace for Customer/Variant/Unit and optional trusted time. |

Price administration filters Product, Variant, SKU, Sellable Unit, List, Customer, status, and useful Brand. Admin schedule/override timestamps are ISO 8601 instants; server/database time governs selection. Bulk validation returns row errors but commits no subset.

## Error vocabulary

| Code | Meaning |
|---|---|
| `PRICE_UNAVAILABLE` | No permitted effective candidate or target cannot be newly purchased. |
| `PRICE_CHANGED` | Cart snapshot differs from current resolver result. |
| `PRICE_PERIOD_OVERLAP` | New schedule conflicts with existing target interval. |
| `DEFAULT_PRICE_LIST_INVALID` | Missing/inactive default or a command would leave no usable default. |
| `PRICING_TARGET_INVALID` | Invalid Variant/Unit relation, amount, interval, sellability, or conversion. |
| `ADMIN_UNAUTHORIZED` | Existing admin authorization failed. |

Public errors hide source/conversion details. Admin diagnostics expose structured reasons without mutating pricing state.
