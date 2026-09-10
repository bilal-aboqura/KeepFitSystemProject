<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Xeemo Ecommerce — project notes

## Verification commands (run after changes)
- Lint: `npm run lint`
- Typecheck + build: `npm run build`
- Dev: `npm run dev` (http://localhost:3000)

## Database scripts (run with env loaded from .env.local)
- Apply schema + seed catalog/locations/shipping: `node --env-file=.env.local scripts/migrate.mjs`
- Create/refresh owner admin: `node --env-file=.env.local scripts/seed-admin.mjs`
- Schema DDL lives in `supabase/schema.sql`. Migrations use `DIRECT_URL` (session pooler, port 5432).

## Critical version facts (Next.js 16 + React 19 + Tailwind v4)
- **Middleware is `proxy.ts`** at `src/` level (exports `proxy` + `config.matcher`). Same functionality as the old middleware.
- **`params` and `searchParams` are Promises** — always `await` them in pages/route handlers.
- **`useSearchParams`** must be inside a `<Suspense>` boundary or the route opts into dynamic rendering.
- **No `as const` on the i18n dictionary** (`src/lib/i18n/translations.ts`) — it widens locales to a shared `string` shape so `ui[lang]` typechecks.
- **Language state** uses `useSyncExternalStore` over `localStorage('lang')`; do NOT use `setState` in effects for this (React 19 `set-state-in-effect` rule).
- **Tailwind v4**: brand tokens are CSS variables under `@theme` in `src/app/globals.css` (e.g. `bg-brand`, `text-gold`, `font-display`, `.glass`).
- `unstable_instant` is an *opt-in* feature tied to `cacheComponents` — do NOT add it unless enabling Cache Components.

## Architecture
- Single Next.js app serves storefront (`/`) and admin (`/admin/*`). Admin is gated by `src/app/admin/(protected)/layout.tsx` (server-side auth) + an optimistic redirect in `proxy.ts`. `/admin/login` is outside the protected group to avoid loops.
- Supabase clients in `src/lib/supabase/` return `null` when env is missing (scaffold mode). Don't hard-fail on missing keys.
- Kashier secret keys and the Supabase service-role key are **server-only** — never import them into Client Components.

## Code style
- No comments unless explaining a non-obvious decision.
- Use the `cn()` helper from `src/lib/utils.ts` for class merging.
- Keep components in `src/components/{language,storefront,admin}`.
