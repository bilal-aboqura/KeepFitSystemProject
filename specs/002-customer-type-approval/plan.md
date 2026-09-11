# Implementation Plan: Customer Types & Approval

**Branch**: `002-customer-type-approval` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)
**Input**: Approved Feature 002 specification, clarification decision, project constitution, and Feature 001 implementation.

## Summary

Extend the existing Customer-domain modular-monolith boundary with a data-driven customer-type catalog, a single authoritative effective type on each Customer, and an immutable commercial-request history. Retail is seeded as the safe default. Customer-originated Wholesale Trader and Gym Owner requests are pending until an authorized administrator approves them. Server-owned transactional commands finalize approve/reject/direct-assignment actions, prevent stale decisions, audit every sensitive transition, and supersede an active pending request on direct assignment. Account and admin experiences consume these commands; prices and checkout behavior remain unchanged.

## Technical Context

**Language/Version**: TypeScript, Next.js 16.2.9, React 19.2.4  
**Primary Dependencies**: Supabase JS/SSR, Supabase PostgreSQL/Auth, Zod, Vitest  
**Storage**: Supabase PostgreSQL; existing Auth and server-only service-role access  
**Testing**: Vitest unit/integration tests, `npm run lint`, `npm run build`, targeted manual mobile/RTL and integration smoke tests  
**Target Platform**: Responsive web, Arabic RTL-first and English LTR, approximately 390 px mobile viewport  
**Project Type**: Existing Next.js App Router modular-monolith web application  
**Performance Goals**: Account type state and the default pending queue view are usable within 2 seconds on a normal mobile connection; decisions complete in a single user action under normal service conditions  
**Constraints**: Reuse canonical `customers`; `profiles.is_admin` remains the admin authority; service-role credentials remain server-only; request state is never a pricing input; no duplicate active pending request per Customer; no pricing changes  
**Scale/Scope**: One storefront/admin app and primary database; initial catalog of three types, with catalog records extensible for future types

## Constitution Check

*GATE: Passed before research and re-checked after design.*

- [x] Preserves the existing Next.js/React/Supabase modular monolith and its one primary database.
- [x] Makes `customers.customer_type_id` the single effective-type source of truth and exposes intentional Customer-domain interfaces.
- [x] Does not affect Product Variant, inventory, or pricing behavior.
- [x] Places request validation, authorization, transitions, and multi-record changes in server/database transaction boundaries; documents audit controls.
- [x] Defines lifecycle event readiness without introducing a queue, microservice, or automation engine.
- [x] Includes targeted authorization, RLS, state-transition, concurrency, migration, and Feature 001 regression tests.

## Technical Architecture

### Ownership and relationships

```text
auth.users (optional account) → customers (canonical identity) ──→ customer_types (effective type)
                                      │
                                      ├──→ customer_type_requests (durable submission/decision history)
                                      └──→ customer_type_audit_events (sensitive transition history)
profiles.is_admin (existing admin authorization projection)
```

`customers.customer_type_id` is the only effective-type authority. It is never derived from request records, contact data, orders, Google metadata, or client state. `customer_type_requests` records a requested type and its lifecycle independently. `profiles` remains the existing Auth-keyed admin projection, not a parallel Customer model.

### State and command boundaries

Customer commands run through new server-only `src/lib/customers` modules and narrow customer API routes. They resolve the current Customer from the authenticated server session and never accept a customer ID from the browser. Admin routes invoke `requireAdmin()` before service-role access. PostgreSQL security-definer RPCs own multi-record transitions and validate the caller context through parameters supplied only after server authorization; their execution is revoked from browser roles and granted only to the service role.

```text
request:       none/final → pending
approval:      pending → approved + effective type update + audit
rejection:     pending → rejected + audit
direct assign: any effective type → selected active type
               + active pending request → superseded + audit
```

The approval RPC updates request decision metadata and `customers.customer_type_id` atomically. The rejection RPC changes only request decision metadata/audit. The direct-assignment RPC changes the effective type, supersedes the sole pending request if present, and records the transition atomically. All finalization RPCs condition on `status = 'pending'` so stale or repeated actions return a conflict rather than overwriting a decision.

### Migration and security design

Add `supabase/migrations/002_customer_type_approval.sql` and a dedicated `scripts/migrate-feature-002.mjs` runner, then reflect convergent definitions in `supabase/schema.sql`. The migration seeds `retail`, `wholesale`, and `gym_owner`, adds a nullable relationship long enough to backfill every existing Customer to Retail, then establishes non-null integrity and indexes. It creates request/audit storage, a partial unique index for one `pending` request per Customer, timestamps, narrow read policies, and private server command functions.

Customers can read only their own effective-type projection and own requests; they cannot insert/update effective types or request decision fields through direct table access. Public request options read only active customer types. Admin pages use existing server-side `requireAdmin` plus service role. Database direct-mutation grants are revoked from `anon` and `authenticated`; customer request creation uses the guarded server command rather than broad RLS insert/update. Existing Feature 001 RLS remains intact.

### UI integration

Extend the existing account overview (rather than redesign the account) with an Account Type section and reusable commercial-request form. It shows the current effective type, active request, status/reason where public, and type choices if eligible. Arabic/English labels come from the existing translation dictionary; stable type codes drive all rules.

Add an Admin Customer Type Requests page with filters defaulting to Pending, a request detail view with explicit Approve/Reject controls, and direct assignment from the existing Customer admin surface. Add a single linked “Needs Your Attention” count to the current admin dashboard. No catalog, cart, checkout, payment, or pricing component receives customer-type branches.

## Implementation Sequence

1. **Data foundation**: Define Customer Type, request, and audit types; add migration/runner/schema convergence; seed types; safely backfill Retail; add indexes, RLS, grants, and transition RPCs.
2. **Customer domain commands**: Add schemas, catalog/effective-type queries, request creation, history projection, and typed wrappers around guarded transition commands.
3. **Customer account**: Add API contracts and Account Type UI states/forms, using current session-only identity and localized responsive copy.
4. **Admin operations**: Add queue/detail/direct-assignment data queries, guarded routes, pages/components, filters, and dashboard attention link/count.
5. **Hardening**: Add unit/integration coverage, migration validation, concurrency/authorization/RLS negatives, mobile RTL review, and Feature 001/integration regression smoke tests.

## Exact Files / Modules Expected to Change

| Area | Existing | Planned additions/changes |
|---|---|---|
| Migration | `supabase/schema.sql`, `scripts/migrate-feature-001.mjs`, `supabase/migrations/001_customer_identity.sql` | `supabase/migrations/002_customer_type_approval.sql`, `scripts/migrate-feature-002.mjs`, convergent schema updates |
| Customer domain | `src/lib/customers/{types,identity,session,queries,validation}.ts` | `customer-types.ts`, `type-requests.ts`, `type-approval.ts`, extended types/validation/queries |
| Customer API | `src/app/api/customer/{me,addresses,orders}/**` | `type-state/route.ts`, `type-requests/route.ts`, `type-requests/history/route.ts` or equivalent convention-aligned routes |
| Admin API | `src/lib/admin-auth.ts`, existing `src/app/api/admin/**` routes | customer-type request queue/detail/approve/reject/direct-assignment routes guarded by `requireAdmin` |
| Storefront account | `src/app/(storefront)/account/{layout,page}.tsx`, `src/components/storefront/**` | localized account-type section/form/status components or a focused account-type route |
| Admin UI | dashboard, Customers page, sidebar, `src/lib/data/{admin,admin-crud}.ts` | pending count, customer-type data queries, request queue/detail pages and components, direct assignment action |
| Localization | `src/lib/i18n/translations.ts` | Arabic/English type, state, form, validation, and admin queue copy |
| Tests | `tests/unit/customers/identity-profile.test.ts` | customer-type validation/command unit tests and integration/RLS/route tests |

## Testing Strategy

- Verify migration seeds exactly one active Retail baseline and backfills all existing Customers without touching Auth links, addresses, orders, or snapshots.
- Exercise request eligibility: authenticated canonical Customer only, active protected type only, no Retail request, shared business phone allowed, one active pending request, and protected-to-protected request retains current effective type.
- Exercise transitions: approve atomically updates effective type; reject preserves it; stale/repeated finalization conflicts; direct assignment supersedes pending request; superseded requests never finalize later; assignment back to Retail is explicit and audited.
- Exercise authorization/RLS: customer can read only own state/history; cannot change type/status/decision fields or impersonate another Customer; ordinary user cannot invoke admin decisions; inactive types reject authoritatively.
- Verify public vs internal rejection notes, history preservation and legitimate reapplication.
- Run `npm run test`, `npm run lint`, and `npm run build`; smoke Google login, profile, addresses, guest/authenticated checkout, order history/details, admin login/customer visibility, COD, Kashier, Bosta, Mylerz, notifications, and analytics.
- Manually validate Arabic RTL and English LTR flows at approximately 390 px and desktop, including empty/loading/error/pending/rejected/approved states.

## Risks, Rollback, and Feature Boundaries

- **Migration risk**: introduce the relationship additively, backfill before enforcing non-null, and validate all Customer counts. Incident rollback disables new routes/UI while retaining added records; do not delete classification history.
- **Concurrency risk**: rely on conditional server/database transition logic and the partial pending-request invariant, not browser state.
- **Authorization risk**: no `authenticated` write grants for type/status fields; every admin command uses `requireAdmin` and private service-role execution.
- **Privacy risk**: keep internal decision notes out of customer projections and errors.
- **Pricing boundary**: Feature 004 consumes only the effective-type relationship/query. Feature 002 must not change prices, discounts, quantities, cart, checkout, or order snapshots.
- **Integration risk**: existing orders, customer identity, payments, shipping, notifications, analytics, and guest checkout continue without customer-type behavior.

## Project Structure

### Documentation (this feature)

```text
specs/002-customer-type-approval/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── customer-type-api.md
└── tasks.md                    # created later by /speckit.tasks
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (storefront)/account/   # existing account, extended type experience
│   ├── admin/(protected)/      # existing dashboard/customers, new request operations
│   └── api/{customer,admin}/   # narrow HTTP command/query handlers
├── components/{storefront,admin,language}/
└── lib/
    ├── customers/              # Customer type queries and server-owned commands
    ├── data/                   # admin projections/dashboard count
    └── i18n/
supabase/migrations/
scripts/
tests/{unit,integration}/
```

**Structure Decision**: Keep the existing App Router application and Customer domain boundary. The database remains the single source of truth; customer and admin UI stay thin clients of narrow, server-authorized domain commands.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Private transactional database commands | Approval and direct assignment update multiple durable records and must resist stale concurrent decisions. | Independent service-role updates can leave request/type/audit state partially changed. |
| Customer-type audit history | The constitution and specification require actor, prior/new state, and decision traceability. | Overwriting `customers.customer_type_id` loses operational accountability. |
