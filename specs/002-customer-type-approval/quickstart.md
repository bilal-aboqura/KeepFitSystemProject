# Feature 002 Verification Quickstart

## Prerequisites

- Check out `002-customer-type-approval`.
- Configure `.env.local` with the existing Supabase credentials and `DIRECT_URL`.
- Preserve the Feature 001 database state so existing Customers, Auth links, addresses, and orders are available for migration validation.

## Planned verification sequence

1. Apply the Feature 002 migration using its dedicated runner after implementation. Confirm it seeds `retail`, `wholesale`, and `gym_owner`, and every existing Customer resolves to Retail.
2. Run targeted Customer Type tests, then `npm run test`, `npm run lint`, and `npm run build`.
3. Start the app with `npm run dev` and confirm a newly authenticated Retail customer can submit one Wholesale and one Gym request only as separate resolved workflows.
4. Confirm a pending request leaves the current effective type unchanged and does not change any storefront price, cart, checkout, or order total.
5. As an administrator, find the Pending queue through the dashboard attention item, approve a request, and verify the Customer effective type changes exactly once.
6. Reject a second request and verify the effective type remains unchanged, the public reason is customer-visible only when supplied, and the internal note is absent from the customer view.
7. Create a pending request, directly assign a different Customer Type as administrator, and verify the request becomes `superseded`, cannot later be finalized, and both actions appear in history/audit.
8. Test cross-customer request reads/mutations, direct Customer type/status mutation, and non-admin decision calls; each must be refused without state changes.
9. Smoke existing Google login, profile, addresses, guest/authenticated checkout, My Orders, admin login, COD, Kashier, Bosta, Mylerz, notifications, and analytics.
10. Review Arabic RTL and English LTR states at approximately 390 px and desktop: initial Retail, request form, pending, approved, rejected, error, and empty queue/history.

## Rollback posture

Disable the new UI/routes if an incident occurs; retain additive Customer Type and request/audit records for investigation. Do not delete or reclassify Customer records, orders, Auth links, or decision history as a rollback action.
