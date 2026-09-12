# Feature 003 Verification Quickstart

## Prerequisites

- Check out `003-catalog-variants-media`; configure existing Supabase variables and `DIRECT_URL`.
- Configure non-production R2 account endpoint, bucket, credentials, allowed admin origin, and public media base domain. Never use production bucket/prefix for automated tests.
- Preserve Feature 001/002 Customer/Auth/type-approval data and existing Product/order records for migration checks.

## Verification sequence

1. Run the Feature 003 migration in a safe database copy. Confirm every legacy Product has exactly one default Variant, Product slugs/orders/media URLs remain readable, and no duplicate SKU is silently resolved.
2. Seed the marked non-production demo catalog: multi Weight/Flavor protein, single-Variant creatine, capsule count, strip/tablet, and liquid volume examples.
3. As admin, create Brand/Category/attributes, create reviewed Variants, verify permanent SKU and duplicate-combination rejection, and archive a referenced Variant without breaking historical order display.
4. Upload Product and Variant media using a non-production R2 bucket. Verify unsupported/oversize upload rejection, one primary image, ordering, Variant-media fallback, R2 failure feedback, and archive-before-unreferenced cleanup.
5. As customer, browse only active Products, select valid Variants, confirm invalid/inactive combinations fail safely, and add selected Variant identity to cart. Confirm single Variant requires no selector.
6. Create an order and verify Variant ID/SKU/Product/Variant/price snapshots. Confirm a legacy Product-only cart item maps only to an unambiguous default Variant.
7. Verify Retail, Wholesale, and Gym customers receive identical current base prices. No price-list or Customer-Type branch should appear.
8. Run `npm run test`, `npm run lint`, and `npm run build`; smoke Google auth, account/type approval, guest/authenticated checkout, orders, COD, Kashier, Bosta, Mylerz, notifications, Meta/analytics, sitemap, and JSON-LD.
9. Review Arabic RTL/English LTR list/detail/admin flows at ~390 px and desktop, including gallery, selectors, errors, empty states, and no horizontal overflow.

## Rollback posture

Disable new catalog media/admin/storefront routes if needed while retaining additive Product/Variant/media records. Preserve legacy Product fields, legacy Supabase media URLs, order snapshots, and archived R2 object records. Do not delete catalog history, attempt SKU reuse, or bulk-delete R2 objects as rollback.
