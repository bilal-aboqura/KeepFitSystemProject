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

## Operational Integrations

Kashier, Bosta, Mylerz, notifications, Meta tracking, and analytics are existing working
capabilities. Feature work must preserve them unless an approved specification explicitly
replaces their behavior.
