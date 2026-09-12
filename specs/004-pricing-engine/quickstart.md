# Quickstart: Verify Feature 004 Pricing Engine

## Preconditions

1. Feature 001/002 migrations are applied and an owner admin exists.
2. Feature 003 has deployed Variant, Sellable Unit, packaging conversion, cart, and order-line structures. Confirm actual names before Feature 004 implementation: this repository currently retains Product/client-price checkout source.
3. Use `.env.local` and a non-production Supabase direct URL for migrations and fixtures.

## Migration and cutover

1. Run future `npm run migrate:feature-004`; it must report invalid legacy amounts, missing default units, bad conversions, or incomplete Variant coverage without changing public reads.
2. Confirm Retail/Wholesale/Gym Lists exist, exactly one active default is configured, and mappings are operator-approved.
3. Confirm each sellable primary/default Unit resolves a Guest price. Do not cut over with unresolved expected targets.
4. Compare legacy compatibility price and new default-List output for every migrated Unit in staging. Preserve compatibility fields and take a database backup before production.

## Smoke scenarios

| Scenario | Expected result |
|---|---|
| Guest opens a priced Box | Only default List price is returned. |
| Retail Customer has pending Wholesale request | Retail result, never Wholesale. |
| Approved Wholesale Customer | Mapped Wholesale result. |
| Direct List has no target price | Falls through to type/default only after same-source derivation fails. |
| Customer explicit Ampoule override | Override beats Lists. |
| Box 100, four Ampoules, no explicit Ampoule | Same-source derived Ampoule is 25.00 EGP. |
| Old `[A,B)`, new `[B,C)` at `B` | New row only; overlap returns `PRICE_PERIOD_OVERLAP`. |
| Checkout sends `price: 1` | Persisted totals use resolver result. |
| Current price archived | Safe unavailable/change response and no partial order. |
| Price changes after completed order | Old line/order snapshot does not change. |

## Verification

Run targeted pricing/migration/RLS tests, then established checks:

```powershell
npm test
npm run lint
npm run build
```

Use sandbox/mock external integrations only. Validate COD and Kashier test flows plus mocked Bosta, Mylerz, notifications, Meta, and analytics. Manually verify Arabic RTL and English LTR card/detail/cart/admin/unavailable/schedule states at ~390 px.

## Rollback rehearsal

Rehearse failed preflight and post-schema/pre-cutover rollback before production. Verify legacy reads remain available while compatibility fields exist, no order can use a client price, and no audit or immutable order snapshot is deleted. Missing authoritative price must fail closed with an operator diagnostic, never use a stale client/cart value.
