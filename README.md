# KeepFit System

KeepFit System is a unified commerce and operations platform for a high-volume supplements
business. It evolves the existing ecommerce application into an automation-first system where
people handle exceptions, approvals, and operational issues rather than routine work.

## Current Platform

- Next.js 16 and React 19 storefront and admin application
- Supabase PostgreSQL, Authentication, Storage, and Row Level Security
- Product catalog, cart, checkout, orders, and operational administration
- Kashier payments, Bosta and Mylerz shipping, notifications, and analytics integrations
- Arabic RTL-first interface with existing English support

## Architecture

KeepFit System follows a modular-monolith architecture. Storefront, customer account, admin,
and future warehouse interfaces share one source of truth for customers, product variants,
prices, orders, payments, inventory, shipments, and financial transactions.

The project constitution is authoritative: [.specify/memory/constitution.md](.specify/memory/constitution.md).

## Milestone 1

Milestone 1 establishes the commercial foundation:

1. Customer Identity, Google Authentication & Account
2. Customer Types & Approval
3. Catalog & Variants
4. Pricing Engine
5. B2B Cart, Checkout & Operational Admin Foundation

Feature 001 planning artifacts are in
[specs/001-customer-google-account](specs/001-customer-google-account).

## Local Development

```bash
npm install
copy .env.example .env.local
npm run dev
```

Run quality checks with:

```bash
npm run lint
npm run build
```

## Environment and Database

Copy `.env.example` to `.env.local` and supply local credentials. Never commit `.env.local`,
Supabase service-role credentials, payment credentials, or provider secrets.

Schema DDL lives in `supabase/schema.sql`. Existing database scripts use `DIRECT_URL`:

```bash
node --env-file=.env.local scripts/migrate.mjs
node --env-file=.env.local scripts/seed-admin.mjs
```

Feature migrations must be reproducible and additive; do not make manual production changes.

### Google customer sign-in

Enable Google in Supabase Authentication and register `http://localhost:3000/auth/callback`
for local development plus `https://YOUR-DOMAIN/auth/callback` in production. Add the same
URLs to Supabase's redirect allow-list. The application callback exchanges the code server-side;
never place provider secrets in `NEXT_PUBLIC_` variables.

In Google Cloud, the authorized redirect URI is Supabase's
`https://YOUR-PROJECT.supabase.co/auth/v1/callback`, not the application callback.
Store the Google client ID and secret in Supabase Authentication > Providers > Google.
The OAuth client must be enabled; `disabled_client` is a Google configuration error.
The application supports either the publishable key or the legacy anon key.

### Feature 001 validation

Run `npm run test:customer-db` with the disposable database's `DIRECT_URL` in
`.env.local`. Database fixtures are rolled back; tests use no real orders or shipments.
Run `npm run lint` and `npm run build` before rollout.
The feature migration runner saves a local ignored data/policy backup under `backups/`,
checks the base schema, applies changes transactionally, and checks preserved order counts.
These logical backups contain customer data: keep them private. They complement the
Supabase project backup and are not a full database/PITR replacement.

Run `npm run test:customer-coverage` for the full customer suite and coverage report.
The current acceptance evidence and unresolved external requirements are recorded in
[Feature 001 implementation status](specs/001-customer-google-account/implementation-status.md).

The legacy catalog seeder requires the original `Data/montgat*.json` files.
Feature migrations run independently of this catalog import. Configure products,
delivery locations and provider sandbox credentials before end-to-end checkout acceptance.

## Operational Integrations

Kashier, Bosta, Mylerz, notifications, Meta tracking, and analytics are existing working
capabilities. Feature work must preserve them unless an approved specification explicitly
replaces their behavior.
