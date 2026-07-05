# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project state

This is a freshly bootstrapped `create-next-app` project (Next.js 16.2.10, App Router) named "personal-expense-tracker." The app currently renders only the default starter page (`app/page.tsx`) — no expense-tracking features, data model, routes, or components exist yet. Treat architecture docs below as the current scaffold, not an established pattern to mimic; when building real features, choose structure deliberately rather than inferring it from this starter.

## Commands

```bash
npm run dev     # start dev server (localhost:3000)
npm run build   # production build
npm run start   # run production build
npm run lint    # eslint (flat config, eslint.config.mjs)
```

There is no test runner configured yet.

## Architecture

- **Next.js App Router**, TypeScript, React 19. Routes/layouts live under `app/`; `app/layout.tsx` is the root layout (loads Geist fonts, wraps `app/globals.css`), `app/page.tsx` is the `/` route.
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss` (see `app/globals.css`); no separate `tailwind.config` — v4 is configured through PostCSS/CSS.
- **Path alias**: `@/*` maps to the project root (`tsconfig.json`).
- **ESLint**: flat config extending `eslint-config-next` (core-web-vitals + typescript rules).

## Working with this Next.js version

Next.js 16 has breaking changes relative to older versions you may know from training data — APIs, conventions, and file structure may differ. Before implementing App Router features (routing, data fetching, caching, server/client components, config), check the bundled docs at `node_modules/next/dist/docs/01-app/` rather than relying on prior knowledge. Heed any deprecation notices found there.

## Docs-first rule

Before writing or modifying any code, check `/docs` for a file relevant to the area you're touching and follow it. If a relevant doc exists, its conventions and constraints override default assumptions and prior training data. If no relevant doc exists, proceed using the rest of this file and sound judgment.

Current `/docs` files:

- `docs/ai-workflow.md` — **applies to all work, not just a specific area.** No code is written until a technical plan (architecture, implementation steps) has been proposed and explicitly approved by the user.
- `docs/ui.md` — UI spec: production screens built exclusively from HeroUI components, no custom CSS or hand-rolled elements.
- `docs/auth.md` — authentication: NextAuth v4 (Credentials + JWT sessions), route protection via `proxy.ts` + a server-side Data Access Layer, and per-user data isolation enforced at both the server and database-query level.
- `docs/routing.md` — App Router conventions for this app: route map, folder/route-group structure, protected-by-default routing, naming based on resources/features.
- `docs/errors-and-validation.md` — all user-facing errors render in a HeroUI `Alert` (never raw/technical details); all input validation is defined once with Zod and enforced server-side.
- `docs/data-mutations.md` — all data mutations go through Server Actions (no extra API routes, no client-side mutation logic), called with strongly-typed Zod-validated inputs rather than raw `FormData`.
- `docs/data-fetching.md` — all data reads happen in Server Components via a per-resource Data Access Layer (`app/lib/data/`), never in Client Components or a dedicated API route, with `verifySession()`-scoped, per-user authorization on every query.
- `docs/security.md` — secrets, environment variables, and deployment hygiene: never hardcode credentials, never commit env files, never expose secrets client-side or in logs.
- `docs/best-practices.md` — React/Next.js performance and code-quality conventions, adapted from Vercel's `react-best-practices` guide.
- `docs/charts.md` — charting via `react-chartjs-2`/Chart.js: theming from HeroUI's `--heroui-*` CSS variables, responsive sizing, dynamic-import performance, accessibility. **Currently conflicts with `docs/ui.md`'s HeroUI-only/no-third-party-charts policy** (see the note at the top of `docs/charts.md`) — that conflict must be resolved, and `chart.js`/`react-chartjs-2` added as approved dependencies per `docs/ai-workflow.md`, before building anything against it.
