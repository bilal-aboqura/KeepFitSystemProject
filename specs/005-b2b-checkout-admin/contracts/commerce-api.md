# Commerce API Contract

All interfaces are same-origin Next.js 16 Route Handlers backed by server-only Commerce services. Route Handlers are uncached. JSON bodies are schema-validated, maximum 100 canonical lines, and reject unknown authority-bearing fields. Authenticated context always comes from the session; guest context comes from a server-issued HttpOnly checkout cookie.

Money is serialized as base-10 minor-unit strings plus display values; the server never accepts browser money as authority.

## Canonical line intent

```json
{
  "variantId": "uuid",
  "sellableUnitId": "uuid",
  "quantity": 6
}
```

The API rejects or ignores client fields such as Product ID, Customer ID/type, Price List ID, price, subtotal, discount, shipping, total, rule values, conversion, and base quantity. Product ID is unnecessary once Variant identity is present.

## `POST /api/commerce/cart-quote`

Returns a current, non-confirmable cart projection for a guest/current Customer.

Request:

```json
{
  "lines": [
    { "variantId": "uuid", "sellableUnitId": "uuid", "quantity": 6 }
  ],
  "discountCode": "OPTIONAL"
}
```

Success `200`:

```json
{
  "kind": "cart_quote",
  "currency": "EGP",
  "context": { "kind": "customer_type", "label": "Wholesale Trader" },
  "lines": [
    {
      "variantId": "uuid",
      "sellableUnitId": "uuid",
      "quantity": 6,
      "productName": { "en": "Product", "ar": "منتج" },
      "variantLabel": { "en": "10 ml", "ar": "10 مل" },
      "unitLabel": { "en": "Box", "ar": "علبة" },
      "unitAmountMinor": "10000",
      "lineAmountMinor": "60000",
      "quantityRule": { "minimum": 6, "increment": 2, "eligible": true },
      "availability": "purchasable"
    }
  ],
  "subtotalMinor": "60000",
  "discount": { "code": null, "amountMinor": "0", "state": "none" },
  "validationState": "valid",
  "errors": []
}
```

Shipping and final total are absent until a complete checkout destination/payment context is supplied. The response omits protected Price List/source identifiers.

## `POST /api/commerce/checkout-quotes`

Creates or refreshes a persisted authoritative checkout quote.

Request:

```json
{
  "lines": [
    { "variantId": "uuid", "sellableUnitId": "uuid", "quantity": 6 }
  ],
  "delivery": {
    "savedAddressId": "uuid"
  },
  "contact": null,
  "paymentMethod": "cod",
  "discountCode": "OPTIONAL",
  "notes": "optional"
}
```

`delivery` is exactly one of:

- `{ "savedAddressId": "uuid" }` for an authenticated Customer-owned address;
- `{ "address": { "fullName", "phone", "altPhone", "governorate", "city", "address" } }` for guest or allowed ad-hoc delivery.

Authenticated Customers must have a complete canonical profile. The server verifies saved-address ownership and derives Customer/contact context; submitted Customer identity/type is ignored or rejected.

Success `201` or refresh `200`:

```json
{
  "quoteId": "uuid",
  "revision": 1,
  "state": "draft",
  "expiresAt": "ISO-8601",
  "currency": "EGP",
  "lines": [],
  "subtotalMinor": "60000",
  "discounts": [
    { "kind": "coupon", "code": "OPTIONAL", "amountMinor": "5000" }
  ],
  "shipping": { "amountMinor": "5000", "label": "Cairo / Nasr City" },
  "totalMinor": "60000",
  "errors": []
}
```

An invalid line/destination/coupon returns a safe `422` or `409` result with the same normalized line shape where useful. No quote is confirmable while errors remain.

## `POST /api/commerce/checkout-quotes/{quoteId}/confirm`

Explicitly confirms the current owned quote revision.

Request:

```json
{ "revision": 1 }
```

Success `200`:

```json
{
  "quoteId": "uuid",
  "revision": 1,
  "state": "confirmed",
  "confirmedAt": "ISO-8601",
  "expiresAt": "ISO-8601"
}
```

The server loads and locks the quote, verifies Customer/guest scope, expiry, revision, and eligibility, then records its own fingerprint. It accepts no client fingerprint or confirmed flag.

Errors include `QUOTE_NOT_FOUND` (`404`, also used for wrong scope), `QUOTE_REVISION_CONFLICT` (`409` with current safe quote), `QUOTE_INVALID` (`422`), and `QUOTE_EXPIRED` (`409`, requiring refresh).

## `POST /api/orders`

Consumes one confirmed quote idempotently. This replaces the legacy request that included raw cart/contact/totals.

Request:

```json
{
  "quoteId": "uuid",
  "quoteRevision": 1,
  "submissionId": "client-generated UUID"
}
```

Success or same-submission replay `200`:

```json
{
  "result": "created",
  "replayed": false,
  "orderNumber": "KF-ABC123-260913",
  "redirect": "/checkout/success?order=KF-ABC123-260913"
}
```

For card payment, `redirect` is the protected Kashier hosted-checkout URL derived from the saved authoritative total. A replay returns the same order and may safely regenerate/resume the provider URL; it never inserts another order.

Quote changed `409`:

```json
{
  "error": {
    "code": "RECONFIRMATION_REQUIRED",
    "message": "Commercial terms changed. Review and confirm the updated quote.",
    "changes": [
      { "kind": "unit_price_changed", "line": { "variantId": "uuid", "sellableUnitId": "uuid" } },
      { "kind": "shipping_changed" }
    ]
  },
  "quote": { "quoteId": "uuid", "revision": 2, "state": "draft" }
}
```

The same response applies whether total increased, decreased, or stayed equal due to offsetting changes. No order is created.

## Public error vocabulary

| HTTP | Code | Meaning |
|---|---|---|
| `400` | `INVALID_JSON` | Body is not valid JSON. |
| `404` | `QUOTE_NOT_FOUND` | Quote is absent or not owned by this context. |
| `409` | `RECONFIRMATION_REQUIRED` | One or more confirmed commercial terms changed. |
| `409` | `IDEMPOTENCY_CONFLICT` | Same unexpired submission identity has different bound intent. |
| `409` | `QUOTE_EXPIRED` | Quote must be refreshed and confirmed. |
| `422` | `PROFILE_INCOMPLETE` | Authenticated commerce profile is incomplete. |
| `422` | `VARIANT_UNAVAILABLE` | Variant cannot be newly purchased. |
| `422` | `UNIT_NOT_SELLABLE` | Unit is absent, mismatched, inactive, or not independent. |
| `422` | `QUANTITY_BELOW_MINIMUM` | Quantity is below current minimum. |
| `422` | `INVALID_QUANTITY_INCREMENT` | Quantity is not aligned from the minimum. |
| `422` | `PRICE_UNAVAILABLE` | No authoritative price resolves. |
| `422` | `COUPON_INVALID` | Coupon cannot apply. |
| `422` | `DELIVERY_INVALID` | Delivery input/rule is invalid. |
| `503` | `CHECKOUT_UNAVAILABLE` | Safe retryable internal failure. |

Every error includes a correlation ID for support logs. Customer errors never contain raw database messages, another Customer’s existence, protected pricing source data, guest cookie/hash, or internal stack traces.

## Legacy cart transition

The cart UI may send a separate legacy-resolution request through `cart-quote` using locally detected Product/Variant-only rows. The server returns a canonical target only when exactly one active purchasable path exists. Ambiguity returns `LEGACY_CART_SELECTION_REQUIRED`; unavailability returns `LEGACY_CART_ITEM_UNAVAILABLE`. No endpoint guesses a default on ambiguity.
