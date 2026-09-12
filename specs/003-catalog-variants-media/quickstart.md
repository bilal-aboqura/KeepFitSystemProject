# Feature 003 Verification Quickstart

## Prerequisites

- Check out `003-catalog-variants-media`; configure existing Supabase variables and `DIRECT_URL`.
- Configure non-production R2 account endpoint, bucket, credentials, allowed admin origin, and public media base domain. Never use production bucket/prefix for automated tests.
- Preserve Feature 001/002 Customer/Auth/type-approval data and existing Product/order records for migration checks.
- Keep Feature 004 pricing disabled during Catalog migration verification; only validate the Variant/Sellable Unit/conversion contract until pricing-specific checks.

## Verification sequence

1. Run the Feature 003 migration in a safe database copy. Confirm every legacy Product has exactly one default Variant and each Variant without packaging has one active one-to-one default/base/sellable Unit. Product slugs/orders/media URLs remain readable, and no duplicate SKU/Unit code is silently resolved.
2. Seed the marked non-production demo catalog: multi Weight/Flavor protein, single-Variant creatine, sellable Box→Ampoule, Box→Strip→Tablet with a non-sellable level, parent-only Bottle→Capsule, liquid volume, and nested Carton→Box→Sachet examples.
3. As admin, create Brand/Category/attributes, create reviewed Variants, verify permanent SKU and duplicate-combination rejection, and archive a referenced Variant without breaking historical order display.
4. Upload Product and Variant media using a non-production R2 bucket. Verify unsupported/oversize upload rejection, one primary image, ordering, Variant-media fallback, R2 failure feedback, and archive-before-unreferenced cleanup.
5. As admin, configure Box→5 Strips→10 Tablets; verify exact base equivalents `50/1`, `10/1`, `1/1`, one base Unit, one default sellable Unit, and explicit sellability. Attempt zero/negative conversion, self-parent, cycle, cross-Variant parent, disconnected node, multiple bases/defaults, and referenced semantic mutation; each must fail atomically.
6. As customer, browse only active Products, select valid Variants and Sellable Units, confirm invalid/inactive/non-sellable combinations fail safely, and add both identities to cart. Confirm single Variant/single Unit requires no selector.
7. Create an order and verify Variant ID/SKU, Sellable Unit ID/code/label, quantity, exact units-per-package/base-equivalent, unit price, and line-total snapshots. Confirm a legacy Product-only cart item maps only to an unambiguous default Variant and default Unit, and later hierarchy edits do not change the historical line.
8. Exercise the Feature 004 Catalog seam with Box→Ampoule and Box→Strip→Tablet. Confirm it receives exact same-Variant paths and can apply same-context explicit/nearest-parent-derived resolution; Catalog must not choose Customer Type, Price List, money, or rounding.
9. Verify Retail, Wholesale, and Gym customers receive identical current compatibility prices while Feature 004 is disabled. No price-list or Customer-Type branch should appear in Catalog.
10. Run `npm run test`, `npm run lint`, and `npm run build`; smoke Google auth, account/type approval, guest/authenticated checkout, orders, COD, Kashier, Bosta, Mylerz, notifications, Meta/analytics, sitemap, and JSON-LD.
11. Review Arabic RTL/English LTR list/detail/admin flows at ~390 px and desktop, including Variant/Unit selectors, packaging hierarchy editor, gallery, errors, empty states, and no horizontal overflow.

## Rollback posture

Disable new packaging/media/admin/storefront routes if needed while retaining additive Product/Variant/Unit/media records. Preserve legacy Product fields, one-to-one default Units, legacy Supabase media URLs, order snapshots, and archived R2 object records. Do not delete catalog history, reinterpret referenced packaging, attempt SKU/Unit-code reuse, or bulk-delete R2 objects as rollback.

## Verification record — 2026-09-12

- Packaging/domain, migration, RLS, Feature 004 seam, order snapshot, and Customer regression tests passed against transactional database fixtures.
- `npm run test` passed with 128 tests and one environment-gated skip.
- `npm run test:customer-db` passed with the configured transactional database fixtures; the final rerun is recorded with the implementation handoff.
- `npm run lint` passed with only the pre-existing `src/app/layout.tsx` raw-image performance warning.
- `npm run build` completed successfully on Next.js 16.2.9 and generated all storefront/admin/API routes, including both Packaging admin endpoints.
- Live R2 upload/cleanup and responsive authenticated manual UI checks require the isolated non-production credentials/session tracked by T039; they were not simulated with production resources.
