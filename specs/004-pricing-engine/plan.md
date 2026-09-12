# Implementation Plan: Authoritative Pricing Engine

**Branch**: `004-pricing-engine` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)
**Input**: Approved Feature 004 specification, scheduled-price clarification, technical direction, constitution, existing Feature 001/002 implementation, and Feature 003 design contract.

## Summary

Add one server-owned Pricing domain to the existing Next.js/Supabase modular monolith. It resolves a purchasable `(Variant, Sellable Unit)` from session-derived Customer context and database time by applying Customer override → direct Customer Price List → effective Customer Type mapping → public default List → unavailable. Explicit scheduled unit prices may derive lower sellable-unit prices from their nearest priced packaging ancestor in the same pricing context. Storefront, cart, checkout, admin diagnostics, and Feature 005 consume this one resolver. Checkout stops trusting browser monetary values and persists immutable price snapshots.

## Technical Context

**Language/Version**: TypeScript, Next.js 16.2.9, React 19.2.4
**Primary Dependencies**: Supabase JS/SSR and PostgreSQL, Zod 4, Vitest 4, existing `pg` migration runner; add a server-only fixed-point/decimal helper only if required.
**Storage**: Supabase PostgreSQL. Feature 003 Variant/Sellable Unit/conversion records remain Catalog-owned.
**Testing**: Vitest unit/integration/database-RLS tests, `npm run lint`, `npm run build`, and Arabic RTL/English LTR mobile acceptance at ~390 px.
**Target Platform**: Existing responsive Next.js App Router storefront and `/admin`.
**Project Type**: Existing modular-monolith web application.
**Performance Goals**: One batched query graph for grid/cart/checkout targets; no per-line N+1 resolution; normal selected-unit and cart reprice response usable within two seconds.
**Constraints**: Browser money, Customer ID/type/list, and clock are non-authoritative; EGP only; validity is `[valid_from, valid_until)`; no protected-price leakage; no Feature 005 MOQ/eligibility/inventory behavior.
**Scale/Scope**: One application/database; reusable lists/mappings/overrides, scheduled rows, operational admin management, migration of base prices, and checkout/order snapshot cutover.

## Constitution Check

*GATE: Passed before Phase 0 research and re-checked after Phase 1 design.*

- [x] Extends the existing Next.js/React/Supabase modular monolith; creates neither a pricing service nor database.
- [x] Uses Price Lists, Customer assignment, packaging conversion, sellability, and snapshots in their authoritative domains with intentional interfaces.
- [x] Uses Feature 003 Variant + Sellable Unit as the new commercial pricing/order reference; Product remains browse/SEO context only.
- [x] Makes resolution, checkout totals, configuration mutation, authorization, time validity, and snapshots server/database-authoritative and transactional.
- [x] Defines durable pricing audit/event records and keeps payment/shipping/analytics adapters snapshot consumers without a queue or AI mutation path.
- [x] Requires priority, derivation, rounding, RLS, spoofing, migration, and Feature 001–003/integration regression coverage.

## Technical Architecture

### Ownership and resolver boundary

```text
authenticated session ──→ Customer.effective type ──┐
guest ───────────────────────────────────────────────┤
                                                      ▼
Catalog: Variant + Sellable Unit + conversion ─→ Pricing Resolver ─→ safe price
                                       ▲              │
Price Lists / mappings / assignments / overrides ─────┤
database time ────────────────────────────────────────┘
                                                      ▼
                         storefront · cart · checkout · order snapshot · admin diagnostic
```

Create a focused server-only `src/lib/pricing/` domain (money, validation, context, queries, resolver, packaging derivation, commands, diagnostics, and types). The current `src/lib/pricing.ts` contains legacy subtotal/card-discount helpers; implementation must deliberately move it or retain a non-conflicting compatibility module so there is one canonical import path. Catalog exposes only intentional query interfaces for Variant/Unit activity, labels/SKU, and conversions; Customers exposes only effective type/context. Pricing never reads customer-type request history.

`resolvePrices({ customerContext, targets, at? })` is the only selection API. `at` is permitted only for trusted server/admin diagnostics/tests; storefront/cart/checkout use database/server `now()`. It deduplicates targets, loads context and applicable configuration once, then returns exactly one `ResolvedPrice` or a typed unavailable result per `(variantId, sellableUnitId)`. No shared personalized cache is introduced; request-local memoization is allowed. A future cache must key by pricing-context version, target, and next schedule boundary and be invalidated by every price command.

### Resolution, fallback, and packaging derivation

For each source, first seek an effective explicit target-unit amount, then derive from the nearest effective explicitly priced sellable ancestor in the *same source*. Only if no explicit or derivable candidate exists does the resolver fall through:

1. Customer Variant + Unit override.
2. Active direct Customer Price List.
3. Active effective-Customer-Type mapping.
4. Single active public/default Price List.
5. `unavailable`.

Selection requires an active source List (where applicable), active in-period row, active Variant, and active/sellable Unit. Pending/rejected/superseded Customer Type requests never determine pricing. An inactive Catalog target is unavailable even if historic price rows exist.

The packaging traversal walks Feature 003's parent/child conversion graph upward from the target, selecting the fewest-edge ancestor with an explicit same-source price. Explicit target price beats derived price. A cycle, missing/zero conversion, cross-Variant parent, or equally-near ambiguous ancestors yields unavailable plus an operational event—never a guessed amount. This preserves a Customer Box override when deriving an Ampoule, rather than mixing in a Retail/default price.

### Money and rounding

Persist EGP prices as bounded non-negative integer piastres (`amount_minor bigint`). Serialize public values as `amountMinor` string plus a formatted display amount; do not use JavaScript float as commercial truth. Validate legacy `numeric` base prices have at most two EGP fractional digits before conversion.

Derived price calculation carries an exact integer rational through the conversion path and rounds only once at the requested sellable unit, **half-up to the nearest piastre**. Line total is `roundedUnitMinor × quantity`; no pack-total adjustment occurs later. Repeated derived units can therefore differ from their ancestor pack only by the documented per-unit rounding remainder. The same money helper is used by resolver, cart, checkout, order persistence, and display formatting.

### Data integrity, commands, and RLS

Use service-role access only in server modules after `requireAdminUser()` for configuration commands. Where a multi-row database transaction is needed, use narrowly granted RPCs. Security-definer functions use `search_path = ''`, schema-qualify objects, validate `profiles.is_admin`, revoke execution from `public`, `anon`, and `authenticated`, and grant only `service_role`—an intentional tightening of the Feature 002 pattern.

Price List Items and Customer overrides use `tstzrange(coalesce(valid_from, '-infinity'), coalesce(valid_until, 'infinity'), '[)')`, a `valid_until > valid_from` check when both bounds exist, `btree_gist`, and GiST exclusion constraints keyed by their target identities. Thus adjacent `[A,B)` and `[B,C)` rows are valid, while concurrent overlapping effective rows are impossible. Archive/inactive rows remain historical; command validation prevents an archive/reactivation path becoming ambiguous.

Make these operations atomic and audited:

- create/edit/archive Price List and replace the singleton default configuration without leaving zero/two usable defaults;
- upsert scheduled List Item or Customer override, including optional close-prior-at-start;
- modify Customer Type mapping, direct Customer List assignment, or override after validating active references;
- bulk grid save: validate all rows, commit all or none, use a correlation ID;
- checkout: read targets/prices in a consistent transaction, recalculate every line/subtotal and supported shipping/discount adjustment, write order + snapshots + confirmation grant, or write nothing.

New pricing tables have RLS enabled and all unused `anon`/`authenticated` grants revoked. Public customers do not directly select price matrices. If a narrow direct read becomes necessary, it is an active public projection only; protected resolution remains server-owned. Admin UI never relies on UI hiding for authorization.

### Migration and deployment cutover

Create additive `supabase/migrations/004_pricing_engine.sql`, `scripts/migrate-feature-004.mjs`, and a convergent `supabase/schema.sql` update. The present source tree has Feature 002 implemented but still has Product-level checkout input accepting client prices; Feature 003's Variant/Sellable Unit implementation is absent locally despite its approved artifact. Before Feature 004 coding/cutover, confirm the deployed Feature 003 migration supplies Variant, Sellable Unit, conversion, cart, and order-line structures. Its absence is a hard prerequisite, not a reason to retain Product/client-price checkout.

Migration sequence:

1. Preflight active legacy Products/Variants/Units, base-price precision, duplicate/missing default-unit mapping, and packaging consistency; stop and report unsafe rows.
2. Enable `btree_gist`; add price/config/mapping/override/audit tables, constraints, indexes, RLS/grants, and private commands without changing public reads.
3. Seed active Retail/Wholesale/Gym Lists. Choose one operator-approved default public List and map types only to approved active Lists; never invent B2B prices.
4. Convert each validated legacy Variant base price into an explicit default-List row for that Variant's primary/default Unit. Do not fabricate contained-unit prices.
5. Prove every currently sellable default target resolves a guest price; compare old/new output in staging and retain compatibility columns.
6. Deploy resolver/read paths, then Variant+Unit cart/checkout contract; initially ignore then reject legacy monetary inputs. Remove old price authority only in a later approved migration.

Before cutover, rollback means continue legacy reads after restoring/rolling back schema per backup plan. After cutover, application rollback is permitted only while compatibility values are proven synchronized; never delete Price Lists, audit data, or immutable order snapshots. Unresolved prices fail closed and alert operators instead of falling back to browser/stale price.

### Storefront, cart, checkout, integration, and admin

Server catalog projections derive the current session context once and batch-resolve active displayable targets. Cards use localized `From` pricing only where units differ; Product detail refreshes server-derived price after Variant/Unit selection. Browser receives only current resolved amount/currency/availability and no List IDs, alternate tiers, trace, or overrides. Cart persists `variant_id`, `sellable_unit_id`, `quantity`, and disposable display snapshots.

Add a server reprice boundary accepting only target identities/quantities and returning authoritative unit/line values. Change `/api/orders` to derive Customer from `getCurrentCustomer`, fetch catalog snapshots, resolve all lines, calculate totals, apply existing shipping/coupon/card-discount behavior *after* unit pricing, and write immutable Variant/Unit/SKU/label/base-equivalent/amount/source snapshots. A changed price returns retry-safe `409 PRICE_CHANGED`; unavailable returns `409 PRICE_UNAVAILABLE`; neither creates an order/payment redirect. Kashier uses persisted `grand_total`; COD, Bosta, Mylerz, notifications, Meta, analytics, and history consume stored snapshots rather than live resolution.

Extend existing `/admin`: Price List list/detail; searchable Product/Variant/SKU/Unit/Brand/List/status price grid with transactional bulk edits; schedule editor; Customer Type mapping/default controls; direct List and Customer override controls on the Customer view; and read-only production-resolver diagnostics. Diagnostics accepts Customer/Variant/Unit/optional trusted time after `requireAdminUser`, returning source chain, conversion, interval, rounding and result only to admins. Label explicit versus derived amounts clearly. Development/staging fixtures demonstrate required scenarios; production migrations do not seed fake commercial prices.

Pricing audit events record List/config/item/mapping/direct-assignment/override/bulk changes with action, actor, entity/target IDs, correlation ID, redacted before/after state, reason/context, and time. Use stable event names (`PRICE_LIST_CHANGED`, `PRICE_ENTRY_SCHEDULED`, `CUSTOMER_PRICE_LIST_ASSIGNED`, `CUSTOMER_PRICE_OVERRIDE_CHANGED`) as audit/event readiness only—no Feature 009 queue.

## Implementation Sequence

1. Verify Feature 003 real schema/data and reconcile its approved names before code.
2. Build data foundation: migration/preflight, money validation, configuration, price records, range constraints, indexes, RLS/grants, audit, and runner.
3. Build server Pricing domain: context, batch query, rational money, explicit/derived selection, priority/fallback, commands, diagnostics, and tests.
4. Migrate/cut over safely: seed approved Lists, import defaults, prove coverage and staging parity, then activate authoritative reads.
5. Integrate storefront/cart/orders: Variant/Unit projections and state, reprice endpoint, authoritative checkout, snapshots, adapter compatibility.
6. Add admin List/grid/scheduling/mapping/default/direct-list/override/diagnostic UI with localization.
7. Harden: RLS/RPC/spoofing/concurrency tests, schedule/rounding/derivation tests, migration rollback rehearsal, and Feature 001–003/external integration regression.

## Exact Files / Modules Expected to Change

| Area | Existing | Planned additions/changes |
|---|---|---|
| Database | `supabase/schema.sql`, Feature 001/002 migrations and runners | Feature 004 migration/runner, convergent schema, constraints, RLS/grants, pricing commands, validation fixtures |
| Pricing | `src/lib/pricing.ts` | Canonical non-conflicting pricing domain for money, context, resolver, queries, packaging, commands, diagnostics, types |
| Customer/Catalog seam | `src/lib/customers/{session,customer-types}.ts`, Feature 003 Catalog modules | Effective-type and Variant/Unit/sellability/conversion query interfaces; direct price-list field/query; no request-history coupling |
| Storefront/cart | `src/lib/data/catalog.ts`, `src/lib/cart.ts`, product/cart/checkout components | current-context projections, Variant/Unit identities, safe snapshots, reprice/change/unavailable states |
| Orders | `src/app/api/orders/route.ts`, `src/lib/data/orders.ts`, order pages/admin editor | authoritative DTO/resolution, snapshots/read models, safe errors, legacy-order compatibility, adapter snapshot use |
| Admin | existing admin routes/components and Customer page | Price List/grid/schedule/mapping/default/assignment/override/diagnostics routes and focused components |
| Types/tests | translations and `tests/{unit,integration}` | pricing types/locales; resolver/money/RLS/migration/checkout/derivation/rounding/regression tests |

## Testing Strategy

- Database: exactly one usable default, reference activity, bounded piastres, `[A,B)`/`[B,C)` boundary, overlap rejection, archival history, migration coverage.
- Resolver: guest/Retail/Wholesale/Gym/pending behavior; exact priority and missing-source fallback; inactive/expired/unavailable targets; batch deduplication/query count.
- Packaging/money: explicit over derived; Box→Ampoule; Box→Strip→Tablet; nearest parent; type/Customer override derivation; invalid graph; `100/3` and `100/6` repeatability across resolver/cart/checkout/snapshot.
- Security: fake Customer/type/list/price ignored; Retail tier isolation; Customer A/B isolation; no customer pricing mutation; RLS and function-grant/search-path allow/deny matrix.
- Checkout/history: spoofed price ignored; multi-line recomputation; any unavailable line aborts order; retry-safe change; immutable snapshots; existing orders unchanged; Kashier uses persisted total.
- Regression: Google auth/profile/addresses/orders/type approval; Feature 003 catalog/Variant/media; guest/auth checkout, COD/Kashier, Bosta/Mylerz, notifications, Meta/analytics, coupons/shipping; mocks/sandboxes only; Arabic RTL/English LTR mobile states.

## Deployment, Boundaries, and Risks

Run migration/preflight and parity comparison in staging before production. Monitor `PRICE_UNAVAILABLE`, invalid conversion, exclusion conflict, checkout price-change, resolver latency/query count, and migration exceptions with redacted IDs/context. Database-time schedules activate without restart.

Feature 004 answers only “what authoritative unit price applies now?” Feature 005 may supply `(Customer context, Variant, Sellable Unit, quantity)` and consume price; it must not inspect type requests, Lists, mappings, overrides, or schedules. Feature 005 owns MOQ, quantity rules, inventory, reservations, and final B2B checkout UX. Do not add pricing-driven Catalog coupling, stock mutations, payment proof, or automation infrastructure.

## Complexity Tracking

No constitution violations require justification.
