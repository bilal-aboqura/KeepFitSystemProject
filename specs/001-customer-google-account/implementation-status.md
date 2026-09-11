# Feature 001 implementation and acceptance status

Last verified: 2026-09-11. Feature acceptance remains open; unchecked tasks are not waived.

## Implemented

- Canonical customers with optional unique Auth links, shared phone support, deterministic resolution, and no historical order auto-linking.
- Transactional profile/projection updates, owned address commands/default transitions, and atomic order/items/guest-grant persistence.
- Server-verified account routes, Google callback/return-path validation, sign-out, profile completion, bilingual account/profile/address/order UI, and Arabic-first layout.
- Server-owned order association and immutable checkout snapshots; owned history and private guest confirmation cookies.
- RLS, service-only RPC execution, private grant/audit tables, admin-only product-media mutation, and persistent-customer admin visibility.
- Additive migration runner with transaction, advisory lock, ignored logical data/policy backup, preflight and postflight checks. Canonical schema convergence has an automated equality check.

## Verification evidence

- Requirements checklist: 16/16 complete.
- 15 Vitest files, 82 tests passed, including real PostgreSQL rollback-based RLS and transaction tests against the configured project.
- Production build and TypeScript passed; full lint passed with zero errors and three existing warnings (tracking image and unused home-hero variables).
- Selected customer-module coverage: lines 94.44%, statements 84.45%, branches 73.13%, functions 97.95%. This is not whole-application or browser coverage.
- Migration applied successfully; schema/RLS verified and existing order count preserved. Test fixture data rolls back.
- Browser sign-in page inspected at 390px in Arabic RTL: no horizontal overflow. Google authorization then returned `401: disabled_client`.
- Profile/address render tests cover bilingual labels, prefills, form semantics and touch-target classes; they do not prove browser geometry or the full authenticated journey.
- Mocked checkout regression covers COD/card handoff, canonical ownership, guest cookies, incomplete-profile denial, notifications and Meta invocation. Adapter tests also verify Bosta/Mylerz COD/card snapshot payloads, Kashier return routing and anonymous analytics payloads. No real payment, shipment or outbound notification was created.

## Remaining tasks and exact prerequisites

| Task | Remaining acceptance | Prerequisite |
|---|---|---|
| T018 | Migration on a separately isolated database | Disposable Supabase project/session-pooler connection. Existing tests use rollback isolation on the supplied project, not a separately provisioned database. |
| T039 | All profile/address forms at 390px RTL/LTR | Working Google sign-in and an authorized test account. Static render checks already pass. |
| T059 | Local and production OAuth verification | Enabled Google OAuth client in Supabase, production site URL and matching redirect allow-list. Current Google client is disabled. |
| T063 | Full authenticated mobile walkthrough and sign-out | Enabled OAuth client and test identity, then profile/address/order/confirmation acceptance. |
| T064 | Live guest/authenticated and provider/admin smoke tests | Catalog, delivery locations, shipping rates, provider sandbox credentials and authorized test accounts. |

The configured database currently contains zero products, delivery locations and shipping rates. The original catalog import files are unavailable. No catalog/prices were invented. Configuration presence checks found no Kashier, Bosta, Mylerz, Telegram, Google Sheets webhook, Meta Conversions API or production site URL values. Presence alone would not prove provider readiness.

## Specification and constitution reconciliation

FR-001–025 and FR-027–029 have implementation and targeted tests, with browser/provider-dependent acceptance still open as above. FR-026 integration preservation is partially tested, not fully accepted. SC-002/003 have targeted automated evidence; SC-001/004–007 still need live or browser acceptance. Google remains the only new customer login path, admin authorization remains separate, and no Feature 002 commercial entitlements were added.

Client-submitted price authority remains the explicitly deferred Feature 004/005 risk; atomic order writes do not resolve it. This feature must not be declared production-ready or closed until the remaining acceptance gates pass.

## Resume commands

```powershell
npm run test:customer-coverage
npm run lint
npm run build
node --env-file=.env.local scripts/check-feature-001.mjs
```

Configure credentials locally or in provider consoles, never in tracked files or chat. Follow `quickstart.md` for final acceptance, then check off only the tasks that actually pass.
