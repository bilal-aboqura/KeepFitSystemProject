# Research: Customer Identity, Google Authentication & Account

## Decision: SSR OAuth code-exchange callback with validated local return path

**Rationale**: The project already uses Supabase SSR cookie clients. Supabase's Google OAuth
guidance for SSR/PKCE requires an app callback that exchanges the authorization code and is
listed in redirect allow-lists. A server callback is the correct place to resolve Customer.

**Alternatives considered**: Browser-only implicit handling was rejected because identity
creation/resolution and safe return handling require a server-owned boundary. Password and OTP
methods are prohibited by the feature specification.

## Decision: Resolve Customer by Auth user ID only

**Rationale**: Auth user ID is the immutable authenticated identity. Email and phone are
contact fields that can be absent, changed, or shared; the approved clarification permits
phone duplication.

**Alternatives considered**: Phone or email lookup was rejected because it could attach an
account to an unrelated operational customer.

## Decision: Retain `profiles`; add `customers` as business root

**Rationale**: Admin protection currently depends on `profiles.is_admin`, while the
constitution requires Customers without Auth accounts. A nullable unique Auth link from
Customer preserves both without a broad auth/admin rewrite.

**Alternatives considered**: Making Profiles the Customer root was rejected because it makes
an unauthenticated operational customer impossible. A separate service/database violates the
modular-monolith constitution.

## Decision: Narrow RLS and server-owned mutations

**Rationale**: Once customers authenticate, every `authenticated` policy must be treated as
customer-facing, not operational trust. RLS follows Auth-user-to-Customer ownership; narrow
server commands handle mutation. User-editable metadata is never authorization data.

**Alternatives considered**: Broad authenticated CRUD and UI-only authorization were rejected
as cross-customer/privilege-escalation risks.

## Decision: Use a hashed, cookie-delivered guest confirmation grant

**Rationale**: A random opaque secret, persisted only as a hash and delivered in an HttpOnly
first-party cookie, avoids predictable-order disclosure and URL/referrer leakage. A 30-day
expiry supports COD and hosted-card return confirmation.

**Alternatives considered**: Order number alone exposes PII; a URL secret leaks through logs,
referrers, analytics, and copied links; mandatory account creation violates guest checkout.

## Decision: Introduce a narrow versioned migration beside current schema tooling

**Rationale**: `schema.sql` is idempotent but is applied by a seeding script, not an ordered
production history. One feature migration plus dedicated runner is reproducible while
`schema.sql` remains the convergent schema view.

**Alternatives considered**: Manual production SQL is non-reproducible; replacing all
migration infrastructure is unrelated scope.

## Sources

- [Google OAuth with Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side)
- [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
