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
