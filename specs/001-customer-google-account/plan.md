# Implementation Plan: Customer Identity, Google Authentication & Account

**Branch**: `001-customer-google-account` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

## Summary

Evolve the current Next.js/Supabase modular monolith. Add `customers` as the canonical business identity with an optional one-to-one Supabase Auth link, while retaining `profiles` as the existing auth/admin projection. Google OAuth resolves a Customer through one server-side service. Customers complete profile data, manage addresses, and access only their new owned orders. Guest checkout and immutable order snapshots remain intact.

## Technical Context

**Language/Version**: TypeScript, Next.js 16.2.9, React 19.2.4  
**Primary Dependencies**: Supabase JS/SSR, Zod; add Vitest for targeted tests  
**Storage**: Supabase PostgreSQL, Auth, Storage  
**Testing**: Vitest unit/integration tests; existing lint and build gates  
**Target Platform**: Responsive web, Arabic RTL-first, approximately 390px mobile viewport  
**Project Type**: Existing modular-monolith web application  
**Performance Goals**: Usable account content within 2 seconds on a normal mobile connection  
**Constraints**: Google OAuth only; guest checkout remains; no historical auto-linking; service role is server-only; no Feature 002 entitlements  
**Scale/Scope**: One storefront/admin application and one primary database

## Constitution Check

*GATE: Passed before research and re-checked after design.*

- [x] Preserves the existing Next.js/React/Supabase modular monolith and shared database.
- [x] Makes `customers` the shared business source of truth; snapshots remain historical.
- [x] Defers variants, the pricing engine, order lifecycle redesign, and Feature 002.
- [x] Places resolver, profile updates, address defaults, ownership, and order association at server/database boundaries.
- [x] Specifies narrow RLS, transactional writes, auditability, and integration preservation.
- [x] Requires targeted identity, authorization, order, confirmation, admin, and storage tests.

**Known cross-feature blocker**: the current order path accepts client-submitted prices. Feature 001 must not worsen it or claim pricing authority; Feature 004/005 must fix it before Milestone 1 closure.

## Project Structure

### Documentation (this feature)

```text
specs/001-customer-google-account/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/customer-account-api.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/app/(storefront)/account/       # customer pages
src/app/auth/callback/route.ts      # OAuth code exchange
src/app/api/customer/               # narrow customer handlers
src/components/storefront/          # navbar auth/account UI
src/lib/customers/                  # identity, profile, validation, addresses, queries
src/lib/data/orders.ts              # customer ownership integration
supabase/migrations/001_customer_identity.sql
scripts/migrate-feature-001.mjs
tests/{unit,integration}/customers/
```

**Structure Decision**: Keep one App Router application. `src/lib/customers` is the customer-domain boundary; pages render/submit explicit actions, order ownership stays in the order domain, and existing admin authorization stays unchanged.

## Technical Architecture

### Canonical ownership and compatibility

`customers.id` is canonical business ownership. A nullable, unique `auth_user_id` points to `auth.users`, allowing operational customers without accounts. `profiles` remains keyed by Auth user ID and retains `is_admin` for existing admin checks; it is not the Customer root. Resolver and permitted-profile services deliberately synchronize temporary display/contact duplication, while browsers cannot broadly update either row.

`orders` gains nullable `customer_id`. New profile-complete authenticated orders populate `customer_id` and existing `user_id`; guest and historical orders retain null `customer_id`. Existing customer, phone, address, item, and total columns remain immutable checkout snapshots.

### Google OAuth and customer resolution

```text
Storefront → Continue with Google → Google consent → Supabase cookie session
→ SSR callback exchanges code → resolveAuthenticatedCustomer(authUser)
→ profile-completeness check → validated local destination or completion page
```

The resolver finds Customer only by immutable Auth user ID. If none exists, it creates one with available safe Google name/email metadata. It never resolves by email or phone. The unique Auth link and conflict-aware transaction make repeated callbacks idempotent. OAuth errors return to a safe storefront destination with generic localized feedback.

### Profile, addresses, orders, and confirmation

Create `getCurrentCustomer`, `requireCurrentCustomer`, `resolveAuthenticatedCustomer`, `isCustomerProfileComplete`, `updateOwnCustomerProfile`, address commands, and owned-order queries. Extract existing Egyptian phone normalization into server-compatible shared Zod validation. Profile mutation accepts only full name and phone. Address commands authorize ownership, switch defaults transactionally, and enforce at-most-one default in the database.

Checkout remains guest-compatible. With a session, resolve the Customer and reject only an incomplete authenticated checkout. Replace independent order/order-item inserts with a server-owned PostgreSQL RPC so order, items, Customer association, and guest confirmation grant succeed or roll back together. This improves integrity but does not implement the deferred pricing engine.

Owned-order queries filter only by `orders.customer_id`, never phone/name. Authenticated confirmation requires session ownership. Guest confirmation uses a random 256-bit opaque secret stored only as a hash with expiry/revocation metadata. The raw secret is issued in a HttpOnly, Secure-in-production, SameSite=Lax first-party cookie, not a URL; it expires after 30 days, has one active grant per order, and can be revoked/replaced by support. Invalid grants return a generic unavailable response.

## Migration & RLS Strategy

1. Add `supabase/migrations/001_customer_identity.sql` and a dedicated `DIRECT_URL` runner; retain `schema.sql` as the convergent canonical schema.
2. Add `customers`, nullable unique Auth linkage, contact fields, timestamps, Auth-link index, and a non-unique normalized-phone index.
3. Add nullable `orders.customer_id`, foreign key/index, and hashed guest-confirmation grant storage. Never infer historical links from name, email, or phone.
4. Add canonical `addresses.customer_id`, retaining legacy `user_id` temporarily. Backfill only unambiguous Auth-to-Customer addresses; enforce a one-default-per-Customer partial unique index plus transactional commands.
5. Add server-owned RPCs for resolver, address-default changes, and atomic order creation. Revoke public execution and grant only required server authority.
6. Apply narrow Auth-to-Customer RLS for Customer, address, order, and items. Keep `profiles` self-read; add no broad self-update; preserve server admin checks.
7. Replace authenticated product-image mutation policies with an admin-only predicate based on server-controlled `profiles.is_admin`; retain public reads.
8. Validate counts, foreign keys, RLS and storage denials, guest checkout, and admin login before/after migration. Migrations are additive; rollback disables new UI/routes before destructive action.

## Implementation Sequence

1. Database/security foundation: migration workflow, domain types, Customer schema, RPCs, RLS/grants, storage policy, validation, tests.
2. Auth foundation: Google action, SSR callback, safe next validation, resolver, session-aware navbar, logout, completion gate.
3. Account: RTL mobile shell, overview/profile, address CRUD/default commands, empty/loading/error states.
4. Orders: atomic write, authenticated association, profile gate, owned history/detail.
5. Confirmation: guest grants and authenticated ownership; remove order-number-only PII path.
6. Admin/hardening: persistent customer list with basic aggregates, integration/mobility regression.

## Exact Files / Modules Expected to Change

| Area | Existing | New |
|---|---|---|
| Schema | `supabase/schema.sql`, `scripts/migrate.mjs` | `supabase/migrations/001_customer_identity.sql`, `scripts/migrate-feature-001.mjs` |
| Auth | `src/lib/supabase/{client,server,middleware}.ts`, `src/proxy.ts` | `src/app/auth/callback/route.ts`, `src/lib/customers/{identity,session}.ts` |
| Storefront | `src/components/storefront/navbar.tsx`, `src/app/(storefront)/layout.tsx` | `src/components/storefront/customer-auth.tsx`, `src/app/(storefront)/account/**` |
| Customer domain | none | `src/lib/customers/{profile,validation,addresses,queries,types}.ts`, `src/app/api/customer/**` |
| Checkout/orders | `src/app/(storefront)/checkout/page.tsx`, `src/app/api/orders/route.ts`, `src/lib/data/orders.ts`, `src/app/(storefront)/checkout/success/page.tsx` | confirmation service/query modules |
| Admin | `src/lib/data/admin-crud.ts`, `src/app/admin/(protected)/customers/page.tsx` | optional customer-row component |
| Tests | none | `tests/unit/customers/**`, `tests/integration/{customer-account,security}/**` |

## Testing Strategy

Add Vitest coverage for resolver idempotency, shared phones, allowed profile fields, address ownership/defaults, authenticated/guest order creation, snapshots, order ownership, guest grants, admin regression, and normal-customer storage denial. Add callback/profile/address/order handler tests and manual local plus production-like Google OAuth/mobile acceptance tests. Run `npm run lint`, `npm run build`, targeted tests throughout, then full feature tests and guest/authenticated COD/card, Kashier, Bosta, Mylerz, notification, analytics, and admin smoke regression at closure.

## Risks, Rollback, and Feature 002 Compatibility

- Historical orders remain unlinked; no automatic name/phone/email merge.
- Preserve all Bosta, Mylerz, Kashier, notifications, Meta, analytics, and WhatsApp consumers through existing order snapshots.
- Callback destinations are local-path validated; customer OAuth never grants admin privilege.
- Guest grants avoid order-number PII disclosure and can be revoked without account creation.
- Rollback is additive: disable customer rollout and retain guest checkout; never delete Customer/order-link data during incident response.
- Customer is Feature 002's relationship root for type, approval, pricing, balance, and communications, but Feature 001 adds no such field, policy, entitlement, or UI.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Database RPCs | Resolver/default/order writes require atomic state. | Independent writes duplicate identities or leave partial orders. |
| Hashed cookie confirmation grant | Guest confirmation must be private without accounts. | Order-number access exposes PII; URL secrets leak. |
