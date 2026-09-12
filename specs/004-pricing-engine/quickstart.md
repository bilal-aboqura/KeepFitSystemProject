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

Resolver output is personalized and request-scoped. Do not place it in a shared/static/ISR cache or cache it globally by Variant alone; safe reuse must include the effective Customer context, Variant, Sellable Unit, pricing-configuration version, and activation instant. Public and authenticated routes resolve with `no-store` semantics. Schedule activation uses the database clock and half-open intervals, so a price becomes current at `valid_from` without an application restart or cache purge.

### Visual acceptance record — 2026-09-13

At a 390 × 844 browser viewport, English rendered LTR and Arabic rendered RTL without horizontal document overflow. Verified the catalog card, priced and unavailable Product detail, selected Unit display, priced and empty Cart, priced and empty Checkout, populated admin Price Grid, scheduled `[start,end)` editor, and admin diagnostic/audit states. Price values, EGP formatting, disabled unavailable actions, localized status/error copy, narrow table layout, and sticky mobile checkout actions remained readable and operable.

### Verification record — 2026-09-13

- Feature 003/preflight: 4 active Variants, no missing/duplicate default Units, no invalid legacy prices, and no invalid conversions.
- `npm run migrate:feature-004`: passed and applied the additive pricing migration.
- `npm test`: 43 files passed; 169 tests passed and 1 intentional skip.
- `npm run test:customer-db`: 43 files passed; 169 tests passed and 1 intentional skip with transactional database fixtures.
- `npm run lint`: passed with zero errors and one pre-existing `@next/next/no-img-element` warning in `src/app/layout.tsx`.
- `npm run build`: passed with Next.js 16.2.9; 87 routes generated/verified.

## Rollback rehearsal

Rehearse failed preflight and post-schema/pre-cutover rollback before production. Verify legacy reads remain available while compatibility fields exist, no order can use a client price, and no audit or immutable order snapshot is deleted. Missing authoritative price must fail closed with an operator diagnostic, never use a stale client/cart value.
