# Milestone 1 Closure Evidence

## AUTOMATED PASS

- Feature 005 commerce suite: 23 files, 58 tests passed on 2026-09-13.
- Full customer/database regression: 68 files, 230 passed, 1 explicitly skipped.
- ESLint: passed with one pre-existing `next/image` advisory in `src/app/layout.tsx` and no errors.
- Next.js 16 production build: passed; all storefront, Commerce API, Admin quantity-rule, Admin Order, and existing integration routes compiled.
- Feature 004 prerequisite migration: preflight, convergent application, service-only resolver, empty search path, and complete public-price coverage passed.
- Feature 005 migration: prerequisite gate, convergent double application, five-table RLS, service-only command grants, empty search path, and legacy-order parity passed. One existing legacy Order remained unchanged.
- Canonical `supabase/schema.sql` was transactionally applied and rolled back successfully after its dependency order was repaired.
- Final closure commands passed: focused Commerce suite, full customer/database regression, ESLint, and Next.js production build.

Implemented and verified scope includes canonical Variant/Sellable Unit cart intent, session-derived Customer context, fixed-point authoritative quotes, 30-minute scoped quote storage, explicit confirmation, commercial fingerprints and safe diffs, transaction-time price/rule revalidation, 24-hour scoped idempotency, atomic v1 Order snapshots, KF order numbers, post-commit effects, quantity-rule administration, operational attention, and server-paginated Admin Orders.

### Requirement reconciliation

| Requirements | Classification | Evidence |
|---|---|---|
| FR-001–FR-004 | Implemented and verified | Canonical intent-only cart, exact Variant/Unit merge semantics, legacy migration, and strict DTO tests. |
| FR-005–FR-014 | Implemented and verified | Contextual quantity resolver, 1/1 fallback, database invariants, atomic Admin replacement/archive, audit rows, and matrix tests. |
| FR-015–FR-021 | Implemented and verified | Product Variant/Unit selection, current price/rule guidance, batched normalization, safe line errors, and client-money rejection. |
| FR-022–FR-032 | Implemented and verified | Authoritative shipping/discount/payment quote, owned-address/session context, explicit confirmation, changed-term diff, and strict final submission. |
| FR-033–FR-040 | Implemented and verified | Immutable v1 snapshots, compatibility totals, atomic rollback injection, historical mutation test, two-connection idempotency race, and recoverable cart intent. Inventory reservation remains explicitly excluded by FR-040. |
| FR-041–FR-050 | Implemented and verified | Coherent Admin navigation, live attention destinations/counts, quantity operations, composite-cursor Orders search/filter/detail, persistent Customer anchors, guest distinction, immutable editor guard, and diagnostics/audit context. |
| FR-051 | Implemented; human acceptance pending | Brand-compatible responsive/bilingual component contracts pass; the required 390 px RTL/LTR human review remains listed separately below. |
| FR-052–FR-054 | Existing and verified | Full Feature 001–004/customer regression, provider isolation tests, and removable non-production Retail/Wholesale/Gym commerce fixtures. External provider sandbox validation remains separate. |
| FR-055 | Implemented | This four-section reconciliation accounts for every agreed Milestone 1 requirement without converting pending checks into passes. |
| FR-056 | Deferred by specification | Advanced lifecycle, deposits/proof, repricing/editing, reservations/inventory, fulfillment redesign, purchasing/finance/reporting/AI/automation, and full audit administration remain outside Feature 005. |

SC-001–SC-005, SC-009, and the automated portions of SC-010–SC-012 are covered by the Commerce and full regression suites. SC-006–SC-008 remain human acceptance criteria and are not claimed below. Provider-specific portions of SC-011 remain external sandbox work.

## MANUAL ACCEPTANCE PENDING

- Arabic RTL and English LTR acceptance at approximately 390 px.
- Keyboard, focus recovery, touch targets, and under-three-minute guest/Retail/B2B journeys.
- Human review of Admin blocker navigation and immutable Order explanation.

These checks remain pending and are not represented as automated passes.

## EXTERNAL SANDBOX PENDING

- Kashier test checkout, signed return, and webhook.
- Bosta and Mylerz sandbox shipment/pickup flows.
- Notification/Telegram, Meta, and analytics capture with production sends disabled.
- Lost-response/provider retry validation against the same committed Order.

No live charge, shipment, notification, or analytics action was performed during implementation.

## KNOWN DEFERRED ITEMS

- Full inventory reservation and allocation: deferred beyond Milestone 1.
- Advanced fulfillment/payment lifecycle and post-order commercial repricing: deferred beyond Milestone 1.
- Reporting, automation, and full audit-administration UI: deferred beyond Milestone 1.
- Production acceptance remains gated on the manual and external sandbox sections above.
