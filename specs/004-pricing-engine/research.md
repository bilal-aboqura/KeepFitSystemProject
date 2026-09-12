# Research: Authoritative Pricing Engine

## Decision: PostgreSQL range exclusion constraints enforce scheduled prices

Use `tstzrange` with inclusive lower/exclusive upper (`[)`) boundaries and a GiST exclusion constraint. The key combines target equality and `&&` overlap: `(price_list_id, variant_id, sellable_unit_id)` for List Items and `(customer_id, variant_id, sellable_unit_id)` for Customer overrides. Enable `btree_gist` for UUID equality in the GiST constraint. Null bounds become infinity.

**Rationale**: PostgreSQL identifies exclusion constraints as the natural non-overlap tool for ranges. It permits `[A,B)` followed by `[B,C)` while preventing concurrent admin/import/direct-SQL overlap. [PostgreSQL range constraints](https://www.postgresql.org/docs/16/rangetypes.html)

**Alternatives considered**:

- Application-only overlap checks: races under concurrent writes.
- One mutable current-price row: cannot represent future schedules or retain audit history.
- Trigger-only validation: possible but less declarative and inspectable than the constraint.

## Decision: use fixed-point EGP piastres and exact rational derivation

Persist amounts as bounded non-negative `bigint` piastres. Carry a derived price as an exact integer rational through the packaging path, then round once, half-up, to the requested unit piastre. Multiply the rounded unit amount by quantity for line totals. Serialize monetary API values as strings plus formatted display output.

**Rationale**: this removes binary floating-point disagreement between TypeScript display, cart, checkout, and persisted orders. It makes difficult divisions such as 100/3 deterministic and documents the permitted per-unit pack rounding remainder.

**Alternatives considered**:

- `number` with `Math.round`: current legacy style but unsafe as pricing authority.
- PostgreSQL `numeric` only: workable but still needs disciplined decimal boundary handling in TypeScript.
- Rounding at each conversion hop: accumulates drift.

## Decision: resolve and derive inside one priority source before falling through

For Customer override, direct List, type-mapped List, then default List, first seek the selected Unit's explicit effective price and next derive from its nearest explicit priced ancestor in the same source. Fall through only if that source has no explicit or derivable candidate.

**Rationale**: preserves commercial intent: a Customer's Box override derives its Ampoule before generic Retail/default price becomes eligible. Explicit lower-level price remains stronger than any derived amount.

**Alternatives considered**:

- Gather candidates globally before sorting: can mix Retail ancestor values into Wholesale/direct contexts.
- Derive only from one fixed base Unit: cannot support multilevel or nearest-parent packaging.

## Decision: resolver is server-owned; admin commands use narrowly secured transactions

Customer-facing route/server boundaries derive session Customer and return only its safe result. Admin handlers pass `requireAdminUser()` then use the server-only service client and limited RPCs for multi-row atomic work. All new tables enable RLS and revoke unused client grants.

**Rationale**: Supabase requires grants and RLS policies to be considered together. Security-definer functions can bypass RLS, so they need an empty pinned search path, schema-qualified identifiers, explicit execute revocation, and a minimal service-role grant. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) [Supabase function security](https://supabase.com/docs/guides/database/functions)

**Alternatives considered**:

- Client List queries/selection: leaks protected tiers and trusts browser context.
- Broad `authenticated` RPC permissions: authentication is not admin authorization.
- Separate pricing service/database: violates the constitution's monolith/single-source-of-truth rule.

## Decision: retain compatibility price fields through validated cutover

Convert Feature 003 Variant base price to an explicit Default List entry for its primary/default Unit only after preflight validation. Prove all current sellable targets resolve Guest price and compare staging values before making the resolver authoritative. Retain legacy fields and order snapshots during the cutover.

**Rationale**: avoids an availability outage and closes current Product/client-price checkout without inventing B2B or contained-unit prices. The actual repository lacks Feature 003 implementation files, so confirming those structures is a prerequisite.

**Alternatives considered**:

- Switch immediately when tables exist: risks unpriced products.
- Derive fake wholesale/gym prices from Retail: invents commercial terms.
- Preserve client-price fallback: leaves the critical vulnerability open.

## Decision: avoid shared personalized cache in Feature 004

Use batch queries and request-local memoization; scheduled activation always compares database time. Any later cache must include pricing-context version, Variant, Sellable Unit, and next schedule boundary, and be invalidated by every pricing command.

**Rationale**: a global or stale cache can leak protected price or miss a scheduled replacement. Correctness is the feature's priority.

**Alternatives considered**:

- Global Variant cache: wrong for Customer-specific pricing.
- Browser cache as authority: stale and spoofable.
