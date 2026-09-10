# Feature 001 Implementation Quickstart

## Before implementation

1. Review `spec.md`, `plan.md`, `research.md`, `data-model.md`, and interface contracts.
2. Preserve Supabase SSR clients, `requireAdmin`, protected admin layout, guest checkout,
   order snapshots, and shipping/payment integrations.
3. Configure Google OAuth in Supabase and Google provider consoles. Add exact local and
   production callback URLs to redirect allow-lists; never commit provider credentials.

## Safe order

1. Implement/test Feature 001 migration in an isolated database and converge `schema.sql`.
2. Implement Customer resolver, validation, RLS/storage tests before exposing sign-in.
3. Add OAuth callback/session UI/profile completion, then account/profile/address workflows.
4. Add atomic order creation/customer association and owned order history.
5. Add guest confirmation grants before removing unsafe success retrieval.
6. Evolve minimal admin customer visibility and run regression/migration validation.

## Verification

- `npm run lint`
- `npm run build`
- Targeted customer, RLS-negative, storage, and guest-confirmation tests
- Local and production-like Google OAuth test
- 390px RTL walkthrough: sign-in, profile, addresses, orders, sign-out
- Guest/authenticated COD/card checkout; Kashier, Bosta, Mylerz, notification, analytics, and admin smoke checks

## Rollback

Migrations are additive. Disable new customer UI/routes if rollout fails while retaining guest
checkout and snapshots. Do not delete Customer/order-link data during incident response;
revoke confirmation grants if needed.
