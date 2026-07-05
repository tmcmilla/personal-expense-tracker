# Routing — Personal Expense Tracker

This document specifies how routing is structured under `app/*` using the
Next.js App Router: folder/file conventions, route naming, layouts, and how
routes are protected. It complements `docs/auth.md` (session/identity
enforcement) and `docs/ui.md` (what each screen contains) — this doc is
about the URL structure and file layout those screens live in.

**Every route under `app/*` is protected by default.** The only
unauthenticated routes are the auth pages themselves and NextAuth's own
endpoint. See §4.

## 1. Principles

- **Routes are named after resources and features, not implementation
  details.** A URL segment is `expenses`, `categories`, `settings` — never
  `data`, `view1`, or a name describing a component instead of what the user
  is looking at.
- **One route per distinct thing the user can navigate to or bookmark.**
  Interactions that don't need their own URL (add/edit expense, per
  `docs/ui.md` §5.4) are modals within an existing route, not separate pages
  — a page/route is created for a screen, not for every UI state.
- **Predictable nesting.** A route's folder path mirrors its URL path
  exactly; there is no routing configuration to keep in sync elsewhere, and
  no special file changes that URL structure without a folder rename.
- **Protected by default, not by exception.** New routes require no extra
  step to be protected — protection is enforced centrally (§4). A route only
  becomes public by being explicitly added to the public allowlist in
  `proxy.ts`.

## 2. Route map

| Route | File | Auth | Purpose |
|---|---|---|---|
| `/login` | `app/(auth)/login/page.tsx` | Public (unauthenticated only) | Sign in |
| `/signup` | `app/(auth)/signup/page.tsx` | Public (unauthenticated only) | Create account |
| `/` | `app/(app)/page.tsx` | Protected | Dashboard (current month summary) |
| `/expenses` | `app/(app)/expenses/page.tsx` | Protected | Expense list, filters, add/edit modal |
| `/expenses/categories` | `app/(app)/expenses/categories/page.tsx` | Protected | Category list, create/delete |
| `/settings` | `app/(app)/settings/page.tsx` | Protected | Profile, preferences, log out |
| `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` | Public (NextAuth's own surface) | Sign-in/sign-out/session endpoints — see `docs/auth.md` §3 |

This is the full route surface for v1. A new screen gets a new row in this
table before it gets a folder — if a screen doesn't fit an existing resource
name from `models/` (`Expense`, `ExpenseCategory`, `MonthlySummary`, `User`),
reconsider the name rather than inventing an ad hoc one.

**Migration note**: `app/login/page.tsx` and `app/signup/page.tsx` currently
exist directly under `app/` (predating this doc and `docs/ui.md`). Moving
them into `app/(auth)/` is a pure file move — the route group changes
nothing about their URLs — and should happen as part of whatever change
next touches those pages, not as a standalone reorg.

## 3. Folder structure

```
app/
  layout.tsx              # Root layout: <html>/<body>, fonts, globals.css
  globals.css
  favicon.ico

  (auth)/                 # Route group — omitted from the URL
    layout.tsx             # Centered-card shell (docs/ui.md §5.1), no Navbar
    login/
      page.tsx
    signup/
      page.tsx

  (app)/                  # Route group — omitted from the URL
    layout.tsx             # Navbar shell (docs/ui.md §3), protected
    page.tsx               # "/" — dashboard
    expenses/
      page.tsx
      loading.tsx
      error.tsx
      categories/
        page.tsx
        loading.tsx
        error.tsx
    settings/
      page.tsx

  api/
    auth/
      [...nextauth]/
        route.ts

  actions/                # Server Actions, colocated by resource
    expenses.ts
    categories.ts
    auth.ts

  lib/
    dal.ts                # verifySession() — see docs/auth.md §4
```

`(auth)` and `(app)` are [route groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups):
the parentheses keep the URL flat (`/login`, not `/auth/login`) while
letting each group declare its own nested layout — the centered auth card
vs. the full Navbar shell. There is exactly one root layout
(`app/layout.tsx`); the groups do not each declare a competing root layout,
so there's no full-page-reload cost when navigating between them.

Non-route infrastructure (the MongoDB connection helper, Mongoose models)
stays where it already is — `lib/mongodb.ts` and `models/*.ts` at the
project root — since it isn't App Router-specific and doesn't need to live
inside `app/`. `docs/auth.md` §3 covers `app/lib/dal.ts` and `app/actions/`
specifically because those two are auth/data-access concerns that belong
next to the routes they protect.

## 4. Route protection

Protection happens in two independent layers — see `docs/auth.md` §4 for
the full mechanics. Summarized here as it relates to route structure:

1. **`proxy.ts`** (project root) runs on every request except static assets
   and `api/auth/*`, and redirects unauthenticated requests to `/login`
   (with a `callbackUrl`) for anything not in the public allowlist
   (`/login`, `/signup`). In this Next.js version, this file **must** be
   named `proxy.ts` — `middleware.ts` is deprecated.
2. **`verifySession()`** (`app/lib/dal.ts`) is called at the top of every
   protected page, layout section that needs the user, Server Action, and
   Route Handler. This is the actual security boundary; `proxy.ts` is UX
   only (avoids a flash of protected content).

Because both layers key off the same "protected by default" posture, a new
folder under `(app)/` is automatically covered by `proxy.ts`'s catch-all
matcher — the only action required when adding a route is calling
`verifySession()` in that route's `page.tsx`, which also gets you the
user's `userId` for the data fetch you almost certainly need anyway.

Next.js also ships an experimental `unauthorized()` function paired with an
`app/unauthorized.tsx` file for rendering a 401 UI. This app doesn't use it
— `verifySession()` calls `redirect("/login")` directly per `docs/auth.md`,
which is simpler for an app with a single login page and no mixed
public/private content on the same route. Revisit this only if a route
needs to show a 401 state instead of redirecting (e.g. a shared link that's
sometimes public, sometimes not) — not the case for any route in §2.

## 5. Layouts

- **`app/layout.tsx`** (root): `<html>`/`<body>`, Geist fonts, `globals.css`.
  No auth logic, no data fetching — per the Next.js caution that layouts
  don't re-render on client-side navigation, so an auth check placed here
  would not re-run on every route change (`docs/auth.md` §4 already avoids
  this by checking in the DAL, not a layout).
- **`app/(auth)/layout.tsx`**: the centered single-column shell from
  `docs/ui.md` §5.1. Wraps `/login` and `/signup` only.
- **`app/(app)/layout.tsx`**: the `Navbar` shell from `docs/ui.md` §3.
  Wraps every protected route. Fetches the current user once (for the nav's
  account `Dropdown`) and passes it down as a prop to children — it does not
  perform the auth check itself (see above); `verifySession()` in each
  page/action still runs independently.

## 6. Dynamic segments

No route in §2 currently needs a dynamic segment — expense/category
create/edit happens in modals (`docs/ui.md` §5.4, §5.5), not dedicated
pages, so there's no `/expenses/[expenseId]` route in v1.

If a future feature needs one (e.g. a shareable/printable single-expense
view), follow the standard convention: `app/(app)/expenses/[expenseId]/page.tsx`,
reading `params.expenseId`, and calling `notFound()` (not a manual 404 render)
when `Expense.findOne({ _id: expenseId, userId })` — scoped by the session's
`userId`, per `docs/auth.md` §5 — returns nothing. A missing document and a
document owned by another user must be indistinguishable to the requester,
consistent with the ownership rule in `docs/auth.md`.

Only reach for a dynamic segment when the resource genuinely needs its own
URL (bookmarkable, shareable, or linked from outside the app). Don't create
one just to give a modal's content a route.

## 7. Loading, error, and not-found states

- **`loading.tsx`** is added per route segment where the page does real
  data fetching that would otherwise block navigation (e.g.
  `app/(app)/expenses/loading.tsx` showing the `Skeleton` state from
  `docs/ui.md` §4). It pairs naturally with the Suspense-boundary pattern in
  `docs/best-practices.md` §1.6 — don't `await` everything at the top of the
  page component if part of the tree can stream in behind a boundary.
- **`error.tsx`** is added per route segment that fetches or mutates data, so
  a failure renders the `Alert`(`color="danger"`) state from `docs/ui.md` §4
  instead of the route crashing to the nearest ancestor boundary.
- **`not-found.tsx`** is only needed if a dynamic segment is introduced
  (§6); none of the current static routes need it.
- There is no custom `global-error.tsx` in v1 — the default root-level error
  boundary is sufficient until a specific need for a fully custom top-level
  crash page arises.

## 8. Naming conventions

- Route segments are lowercase, kebab-case if multi-word (none currently
  are — all top-level resources happen to be single words).
- Collection routes use the plural resource name (`/expenses`,
  `/expenses/categories`), matching the Mongoose model names (`Expense`,
  `ExpenseCategory`) minus casing/pluralization noise.
- Route groups (`(auth)`, `(app)`) are named for their purpose (auth vs. the
  authenticated app shell), not for arbitrary teams or features — with only
  two groups in this app, the split is binary and shouldn't be
  over-subdivided.
- Server Actions are colocated by resource in `app/actions/` (`expenses.ts`,
  `categories.ts`, `auth.ts`) — one file per resource, mirroring the route
  map, not one giant `actions.ts` or one file per individual action.
- Private, non-routable helper files inside a route folder (a route-specific
  component that isn't `page`/`layout`/`loading`/`error`/`route`) are safe
  to colocate directly (e.g. `app/(app)/expenses/ExpenseFilters.tsx`) since
  Next.js only treats the special filenames as route-defining. Use an
  `_components`/`_lib` private folder (underscore prefix) only if a route
  segment accumulates enough colocated files that grouping them clarifies
  the folder, not by default.

## 9. Route Handlers vs. Server Actions

- **Server Actions** (`app/actions/*.ts`) are the default for any mutation
  triggered from within this app's own UI (creating an expense, deleting a
  category, updating settings) — called directly from forms/Client
  Components, each independently calling `verifySession()` per
  `docs/auth.md` §3.
- **Route Handlers** (`app/api/*/route.ts`) are reserved for endpoints that
  need an actual HTTP contract: NextAuth's own `[...nextauth]` route today,
  and, if ever needed, a webhook receiver or a public/external API. Don't
  add a Route Handler for something the in-app UI could call as a Server
  Action instead — it's an unnecessary second surface to secure and
  maintain.

## 10. Metadata

Each `page.tsx` sets its own `export const metadata: Metadata` (already the
pattern in the existing `app/login/page.tsx`) with at least a `title`
scoped to that page — no shared/global title override, no client-side
`document.title` mutation.

## 11. Non-goals

- No `pages/` directory — this is an App Router-only project.
- No parallel routes (`@slot`) or intercepting routes (`(.)folder`) — no
  screen in `docs/ui.md` currently needs slot-based layouts or
  modal-via-URL-interception; add them only when a concrete screen requires
  that pattern, not preemptively.
- No route-level logic in `proxy.ts` beyond the optimistic authenticated/
  public-route check already specified in `docs/auth.md` §4 — anything
  resource-specific belongs in the route's own `page.tsx`/Server Action.
- No dedicated page for something `docs/ui.md` specifies as a modal — see §6.
