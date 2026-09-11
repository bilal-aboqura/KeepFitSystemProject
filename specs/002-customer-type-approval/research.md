# Research: Customer Types & Approval

## Decision: Extend the Feature 001 Customer root with a catalog relationship

**Rationale**: `customers` already provides the canonical persistent identity, while `profiles.is_admin` is the existing admin authorization projection. A foreign-key relationship from Customer to a data-driven type catalog provides one deterministic effective type without duplicating identity or overloading authentication.

**Alternatives considered**: Type-specific customer columns and translated-label branches were rejected because they do not scale to future types. A separate customer service/database violates the modular-monolith and single-source-of-truth requirements.

## Decision: Store request history separately from the effective type

**Rationale**: Pending/rejected requests must not grant privileges or erase a current approved protected type. A durable request record keeps submission and decision history independent from `customers.customer_type_id`.

**Alternatives considered**: A requested-type column on Customer conflates current authority with workflow state and loses historical decisions.

## Decision: Enforce one active request with a partial unique database index

**Rationale**: A unique predicate for `status = 'pending'` prevents double clicks, retries, and concurrent Retail-to-Wholesale/Gym requests regardless of UI behavior. It directly expresses the business invariant of one active commercial request per Customer.

**Alternatives considered**: UI disabling and application-only prechecks race under concurrent submissions.

## Decision: Use private transactional PostgreSQL commands for final transitions

**Rationale**: Approval must update request status, effective type, decision data, and audit record together. Direct assignment must update effective type, supersede the active request, and audit together. A guarded transaction with a `pending` state condition prevents stale administrator decisions from silently overwriting finalized results.

**Alternatives considered**: Separate client or route-layer updates risk partial success. Unconditional updates permit stale decisions. A new queue/service is unnecessary for this feature.

## Decision: Keep type and decision mutations server-owned

**Rationale**: Existing Feature 001 uses server-side Customer resolution and `requireAdmin`. The browser cannot be trusted with Customer IDs, effective types, request status, or `decided_by`. Direct table grants to authenticated users would allow privilege escalation.

**Alternatives considered**: Broad authenticated RLS write access and hidden admin controls were rejected as insufficient authorization boundaries.

## Decision: Use the existing service-role/admin route convention, with narrow RLS reads

**Rationale**: Current admin routes call `requireAdmin` and use the service client. Customer operations use the session-derived Customer. Read policies can expose only the customer’s own type/request projection; commands remain server-owned and do not depend on direct client table writes.

**Alternatives considered**: Treating all Supabase authenticated users as operational users breaks the Feature 001 security model.

## Decision: Seed type codes and localize presentation separately

**Rationale**: Stable `retail`, `wholesale`, and `gym_owner` codes are safe rule inputs. Existing translation architecture provides Arabic RTL and English LTR labels without making translated strings business identifiers.

**Alternatives considered**: Persisting only display names causes language-dependent rules and brittle future changes.

## Decision: Reuse the Feature 001 migration pattern

**Rationale**: Feature 001 has a versioned SQL migration and dedicated `DIRECT_URL` runner, while `schema.sql` remains the convergent schema. Feature 002 should add its own numbered migration/runner and preserve this reproducible model.

**Alternatives considered**: Manual SQL is not repeatable; folding everything into seeding hides production migration order.

## Decision: Keep notification behavior event-ready but in-app only

**Rationale**: The constitution requires meaningful events, but the specification excludes an automation/communications engine. Audit/event-ready lifecycle records enable later subscribers without adding queues or external side effects now.

**Alternatives considered**: Email/WhatsApp/automation workflows expand scope; no event/audit signal leaves later automation coupled to UI/database internals.

## Sources

- Existing Feature 001 plan and migration: `specs/001-customer-google-account/`, `supabase/migrations/001_customer_identity.sql`
- Existing Customer and admin boundaries: `src/lib/customers/`, `src/lib/admin-auth.ts`
- Existing migration runner: `scripts/migrate-feature-001.mjs`
- Project constitution: `.specify/memory/constitution.md`
