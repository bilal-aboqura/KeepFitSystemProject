# Data Model: Customer Identity, Google Authentication & Account

## Ownership model

```text
auth.users (optional account) → customers (canonical identity) → addresses
                                             └───────────────→ orders
profiles (existing auth/admin projection, keyed by auth.users.id)
```

## Customers

| Field | Rule / purpose |
|---|---|
| `id` | Stable immutable business identifier. |
| `auth_user_id` | Nullable unique Auth reference; deterministic account-resolution key. |
| `full_name` | Required before authenticated checkout; editable by customer. |
| `email` | Nullable Google contact value; never a merge key. |
| normalized `phone` | Required before authenticated checkout; indexed but never unique. |
| timestamps | Creation/update observability; no Feature 002 status/type fields. |

One Auth user links to at most one Customer. A Customer may lack an account. Phone/email
similarity never creates or merges Customers.

## Profiles and addresses

`profiles` retains existing Auth-keyed email/name/phone/is_admin fields, with `is_admin`
server-only. Permitted profile commands synchronize temporary duplicate contact/display values.

New addresses use canonical non-null `customer_id`; legacy `user_id` remains only during the
transition. Existing recipient name, phone, governorate, city, and detailed address fields
remain. A partial uniqueness invariant ensures at most one default address per Customer.
First address becomes default; selecting default clears prior default in one transaction;
deleting default promotes a remaining address deterministically or leaves none when empty.

## Orders and guest confirmation

New nullable `orders.customer_id` is canonical ownership. Existing `orders.user_id` is
retained and populated for new authenticated orders. All existing order customer/delivery/item
and financial values remain immutable checkout snapshots. Historical orders keep null
`customer_id` until a future approved claim flow.

Guest confirmation storage holds `order_id`, one-way secret hash, expiry, revocation, and
minimal issuance audit data. The raw secret exists only in the confirmation cookie.

## RLS access matrix

| Resource | Guest | Customer | Admin/service |
|---|---|---|---|
| Customer | none | own row | authorized server/admin view |
| Profile | none | own read; allow-listed command update | existing admin authority |
| Address | none | own Customer addresses | authorized server/admin view |
| Order/items | cookie grant only | own `customer_id` only | authorized server/integrations |
| Product media | public read | no mutation | admin-only mutation |
