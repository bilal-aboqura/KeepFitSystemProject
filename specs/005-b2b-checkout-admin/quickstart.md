# Quickstart: Verify Feature 005 B2B Cart, Checkout & Admin

## 1. Environment safety

Use a non-production Supabase environment with `.env.local`. Confirm `DIRECT_URL` points to the intended session-pooler/database and take a restorable backup before migration rehearsal. Normal automated tests must not use production Kashier, Bosta, Mylerz, Telegram/notification, Meta, or analytics credentials.

Record the starting Git revision, Order count/max creation time, and representative historical Order totals before any staging cutover.

## 2. Hard prerequisite preflight

Do not apply Feature 005 until all checks pass:

- Feature 001: Customer session/profile, owned addresses, guest confirmation grants, Customer order RLS.
- Feature 002: effective `customer_type_id`, Retail/Wholesale/Gym records, approval/assignment RPCs and audits.
- Feature 003: distinct Sellable Unit relation, Unit → Variant constraint, active/independent-sellability state, packaging conversion/base-equivalent resolver.
- Feature 004: Price Lists/mappings/overrides, exactly one usable public default, batch Variant + Unit resolver, database-callable final-transaction resolver, integer EGP amounts and price snapshots.
- Every representative active independently sellable Unit resolves a public/default price; no duplicate/invalid conversion target exists.

The current checked-out repository does not yet pass the Feature 003 Sellable Unit and Feature 004 checks. Complete and verify those owning features first. The Feature 005 runner must abort without writes until the physical contracts are present.

## 3. Migration rehearsal

After prerequisites converge:

```powershell
node --env-file=.env.local scripts/migrate-feature-005.mjs --preflight
node --env-file=.env.local scripts/migrate-feature-005.mjs
node --env-file=.env.local scripts/seed-feature-005-commerce.mjs
```

Expected migration invariants:

- reapplying is convergent;
- public and Customer-Type quantity contexts satisfy their nullability checks;
- a second active rule for the same complete context is rejected;
- new quote/submission/audit/event tables have RLS enabled and no anon/authenticated direct mutation;
- SECURITY DEFINER commands are schema-qualified, empty-search-path, and service-role-only;
- existing Orders remain present with null legacy snapshot version and unchanged totals/order numbers;
- new snapshot columns and compatibility numeric columns agree for Feature 005 fixtures;
- `fulfillment_status = 'pending'` index supports the attention query.

Remove only clearly marked non-production fixtures after testing:

```powershell
node --env-file=.env.local scripts/seed-feature-005-commerce.mjs --remove
```

## 4. Automated verification

Run focused tests first, then the required repository checks:

```powershell
npm test -- tests/unit/commerce tests/integration/commerce
npm run test:customer-db
npm run lint
npm run build
```

The Commerce suite must exercise real database constraints/transactions for uniqueness, RLS, atomicity, and concurrent idempotency. Route/provider behavior may use mocks, but the two-request race test must use separate database connections.

## 5. Quantity-rule matrix

Configure the same Variant/Sellable Unit with these non-production rules:

| Context | Minimum | Increment | Expected valid examples | Expected invalid examples |
|---|---:|---:|---|---|
| Public, no row | 1 | 1 | 1, 2, 3 | 0, fractional |
| Public explicit | 2 | 1 | 2, 3 | 1 |
| Retail | 1 | 1 | 1, 2 | 0 |
| Wholesale | 6 | 2 | 6, 8, 10 | 5, 7, 9 |
| Gym | 3 | 1 | 3, 4 | 2 |

Verify public does not reuse Retail, pending/rejected Wholesale remains Retail, and a second active identical context is authoritatively rejected. Replace a rule atomically and confirm there is never an observable two-rule state.

## 6. Cart and packaging smoke tests

Use a Variant with Box and Ampoule Units and authoritative conversion `1 Box = 4 Ampoules`:

1. Add Box quantity 1 and Ampoule quantity 4; confirm two distinct lines.
2. Confirm Ampoule remains Ampoule even when its base equivalent equals one Box.
3. Confirm Wholesale Ampoule minimum 4 rejects 3 and accepts 4.
4. Confirm Feature 004 derived Ampoule price of 25 from Box 100 produces line total 100 without client math authority.
5. Alter stored browser price/conversion/rule values; server result remains authoritative.
6. Load Variant-only and Product-only legacy cart fixtures. Auto-migrate only unique paths; ambiguity stays visible and blocked until Customer selection/removal.

## 7. Quote and reconfirmation matrix

Create and explicitly confirm a full checkout quote. Between confirmation and submit, independently change:

- line price up and down;
- Variant or Unit purchasability;
- quantity minimum/increment or effective Customer Type;
- coupon validity/amount;
- shipping paid/free/amount;
- offset line price +20 and shipping -20 so total stays equal.

Every case returns `RECONFIRMATION_REQUIRED`, creates no Order, exposes safe changed components, and produces a new draft revision. Reconfirm that revision and submit successfully. Repeat with no commercial changes and verify no unnecessary reconfirmation.

Change only Product description, marketing image, or display ordering and verify the commercial fingerprint remains unchanged.

## 8. Security and idempotency matrix

| Attempt | Expected result |
|---|---|
| Client sends price `1` when current price is `1000` | Ignore/reject client money; quote/order uses 1000. |
| Retail client sends `customerType=wholesale` | Session-derived Retail pricing/rule. |
| Wholesale minimum 10, client sends quantity 1 | `QUANTITY_BELOW_MINIMUM`; no Order. |
| Client sends fake conversion/base quantity | Ignored; Catalog result used. |
| Client sends shipping 0 or 100% discount | Ignored; authoritative policy used. |
| Customer A submits Customer B address/quote/submission | Safe not-found/denial; no disclosure. |
| Same submission twice immediately/after lost response | Exactly one Order; replay returns same safe result. |
| Same key concurrently from two connections | Exactly one Order. |
| Same unexpired key with changed payload | `IDEMPOTENCY_CONFLICT`. |
| Same successful submission within 24 hours | No duplicate. |
| Inject line/event/grant write failure | No Order, consumed quote, or accepted submission survives. |
| Payment initialization fails after Order commit | Retry resumes same Order/provider path; no new Order. |

## 9. Historical snapshot test

Create an Ampoule order, then change Product and Variant labels, SKU availability, Unit label, packaging conversion, price/source, quantity rule, Customer Type, Customer profile, and saved address. Customer history and Admin detail must still show the original Customer/destination, Product/Variant/SKU/Unit, quantity/base equivalent, rule, unit/line amounts, adjustments, shipping, total, currency, and payment context.

Attempt existing Admin item replacement on the new snapshot-v1 Order; it must be rejected. Confirm a clearly identified legacy Order remains readable and, only if retained by the compatibility policy, editable through the legacy path.

## 10. End-to-end acceptance

### Guest

```text
Browse → Variant → Sellable Unit → public price/rule → cart quote
→ guest delivery → checkout quote → confirm → COD/card → one Order
→ secure guest confirmation
```

### Retail

```text
Google login → complete profile → Retail price/rule → owned saved address
→ quote → confirm → Order → My Orders
```

### Wholesale Milestone 1

```text
New Customer → Google login → complete profile → Retail
→ request Wholesale → Admin attention → Admin approves
→ effective Wholesale → Product → Variant → Sellable Unit
→ Wholesale price + quantity rule → valid cart → authoritative quote
→ explicit confirmation → idempotent transactional Order
→ My Orders → Admin Orders/detail → pending-fulfillment attention
```

### Gym

Repeat checkout with approved Gym context and its own price/rule. No Retail/Wholesale/Gym-specific checkout page or branch may be required.

## 11. Admin acceptance

- Dashboard counts every and only `fulfillment_status = 'pending'` Order as requiring attention, regardless of age/view state.
- Pending Customer-Type, Order, and reliable commerce-blocker items link to matching filtered views.
- Quantity manager clearly distinguishes Public from Customer Type and shows fallback versus stored rule.
- Orders search by number/name/phone/SKU and filter by date, existing status, payment method, and Customer-Type snapshot using server pagination.
- Guest Orders are explicit; authenticated Orders link to persistent Customer without phone inference.
- Detail explains immutable Unit, base equivalent, quantity rule, prices, adjustments, shipping, totals, payment and current status.
- Arabic RTL and English LTR remain usable at approximately 390 px with no horizontal overflow, keyboard/focus loss, unreadable errors, or undersized primary controls.

## 12. External sandbox checks

Run separately from the normal automated suite:

- Kashier test checkout and signed return/webhook with committed server amount;
- mocked/sandbox Bosta and Mylerz snapshot consumption without live shipment/pickup;
- captured notification/Telegram and Meta/analytics payloads with no production send;
- duplicate replay produces no second provider/purchase side effect.

Record external results independently; a pending provider sandbox does not become an automated pass.

## 13. Deployment and rollback rehearsal

Deploy in the order documented in [plan.md](./plan.md): prerequisites, additive Feature 005 schema, dual-read compatibility, quote UI, authoritative order cutover, then Admin operations. Monitor stable error codes, quote-change rate, idempotency conflict/replay, transaction failure, and payment initialization failure with correlation IDs and no sensitive payloads.

Rehearse:

1. failed preflight with zero writes;
2. rollback after schema but before order cutover;
3. application rollback after cutover while compatibility writes remain;
4. full backup restore for destructive failure;
5. parity checks for Orders, totals, consumed quotes, submission links, and provider references.

Never roll back by restoring client-controlled pricing or deleting commerce snapshots/audits/idempotency evidence.

## 14. Closure report

Publish four separate results:

```text
AUTOMATED PASS / FAIL
MANUAL ACCEPTANCE PASS / PENDING
EXTERNAL SANDBOX PASS / PENDING
KNOWN DEFERRED ITEMS
```

Attach the Milestone 1 reconciliation classifying every agreed requirement as implemented, existing and verified, or deferred to a named Feature. Do not claim production acceptance from lint/build/unit tests alone.
