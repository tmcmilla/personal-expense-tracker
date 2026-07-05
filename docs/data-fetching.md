# Data Fetching — Personal Expense Tracker

This document specifies how data is *read* (as opposed to mutated — see
`docs/data-mutations.md`) for `Expense`, `ExpenseCategory`, `MonthlySummary`,
and any resource added later. It complements `docs/auth.md` (session/identity
enforcement), `docs/routing.md` (Server Actions vs. Route Handlers), and
`docs/best-practices.md` §1/§3 (waterfalls, streaming, RSC performance) —
this doc is specifically about the read call shape: where a query lives, who
is allowed to call it, and how its result reaches a component.

## 1. Principles

- **Server Components are the only place this app's data is fetched.** Every
  read of `Expense`, `ExpenseCategory`, or `MonthlySummary` happens inside an
  `async` Server Component (directly, or via a data-fetching function it
  calls) — never inside a `"use client"` component, and never via `useEffect`
  + `fetch` or a client data-fetching library (SWR, React Query) against this
  app's own data. A Client Component that needs data receives it as a prop
  from its Server Component parent.
- **No Route Handler exists solely to serve this app's own UI data.** Same
  rule `docs/data-mutations.md` §1 already applies to writes: Route Handlers
  (`app/api/*/route.ts`) are reserved for a genuine external HTTP contract
  (NextAuth's own endpoint, a future webhook or public API), never as a
  `GET` endpoint for a Client Component to `fetch()` against. If a Server
  Component needs data, it queries directly — adding a same-origin API layer
  in between is an unnecessary second surface to secure and maintain, per
  `docs/routing.md` §9.
- **Authorization is never optional, and never inferred from the client.**
  Every data-fetching function calls `verifySession()` (`app/lib/dal.ts`)
  first and scopes its query by the returned `userId` — never a `userId`
  read from a route param, search param, or any other client-supplied value.
  This doc doesn't repeat `docs/auth.md` §4–§5's rules, it assumes them.
- **Fetch where the data is used, not at the top and drilled down.** Colocate
  a `await` with the component that needs its result (per
  `docs/best-practices.md` §1), and let sibling sections of a page fetch
  independently and in parallel rather than one ancestor awaiting everything
  before rendering any of it.

## 2. Where data-fetching functions live

Resource reads are centralized in a small **Data Access Layer**, following
the same per-resource file convention already used for Server Actions
(`docs/data-mutations.md` §2) and validation schemas
(`docs/errors-and-validation.md` §2):

```
app/lib/
  dal.ts             # verifySession() — identity only, see docs/auth.md §4

  data/
    expenses.ts       # getExpenses, getExpenseById
    categories.ts     # getCategories
    monthly-summary.ts # getMonthlySummary
```

`app/lib/dal.ts` stays scoped to *identity* (`verifySession()`), exactly as
`docs/auth.md` §3 already specifies. `app/lib/data/*.ts` holds the
*resource* queries that use that identity — this split keeps `dal.ts` small
and reusable by both reads and writes, while each resource's query logic
lives next to the other things that resource cares about (its Server
Actions in `app/actions/`, its Zod schema in `app/lib/validation/`).

A data-fetching function:

- Starts with `import "server-only"` — the same defense-in-depth already
  used in `models/*.ts` and `app/lib/dal.ts`, so an accidental import from a
  Client Component fails the build instead of silently leaking a database
  driver into the client bundle.
- Calls `verifySession()` itself rather than accepting `userId` as a
  parameter from its caller — a page/layout can't forget the check, and
  can't be tricked into passing the wrong user's id, because the function
  never accepts one.
- Returns only the fields the calling UI actually needs (a DTO), not the
  full Mongoose document — see §5.

```ts
// app/lib/data/expenses.ts
import "server-only";
import { verifySession } from "@/app/lib/dal";
import Expense from "@/models/Expense";

export async function getExpenses(filter?: { categoryId?: string }) {
  const { userId } = await verifySession();

  return Expense.find({ userId, ...filter })
    .sort({ date: -1 })
    .lean();
}

export async function getExpenseById(expenseId: string) {
  const { userId } = await verifySession();

  // Scoped by _id AND userId in the same query — a request for another
  // user's expenseId simply matches nothing, per docs/auth.md §5.
  return Expense.findOne({ _id: expenseId, userId }).lean();
}
```

## 3. Calling a data-fetching function from a Server Component

A `page.tsx` (or a server-only component it renders) calls the function
directly and awaits it — no separate `fetch()` round trip to a same-origin
API, since the Server Component and the data-fetching function run in the
same server process:

```tsx
// app/(app)/expenses/page.tsx
import { getExpenses } from "@/app/lib/data/expenses";
import { ExpenseTable } from "./ExpenseTable";

export default async function ExpensesPage() {
  const expenses = await getExpenses();
  return <ExpenseTable expenses={expenses} />;
}
```

```tsx
// app/(app)/expenses/ExpenseTable.tsx
"use client";

import type { ExpenseDTO } from "@/app/lib/data/expenses";

export function ExpenseTable({ expenses }: { expenses: ExpenseDTO[] }) {
  // Renders/sorts/filters the array it was given — it never fetches its
  // own data, per §1.
  return /* ... */;
}
```

`ExpenseTable` is a Client Component only because it needs interactivity
(sorting, row actions) — its data arrives entirely as a prop. This is the
same division of labor `docs/data-mutations.md` §4 already uses for writes:
Server Components/Actions touch the database, Client Components hold UI
state and call into the server for anything that needs fresh data or a
mutation.

## 4. Per-user authorization

This section restates `docs/auth.md` §4–§5 as it applies specifically to
reads — it doesn't introduce a different rule, it applies the existing one
to every data-fetching function:

- **Every data-fetching function calls `verifySession()` first.** A page
  calling `verifySession()` itself (for a redirect, or to read `userId` for
  a different purpose) does not exempt the data-fetching function it also
  calls from doing its own check — `docs/best-practices.md` §3.1's "Server
  Actions are authenticated like API routes" applies equally to a data
  read: nothing about being called from an already-protected page makes a
  function's own database query safe to leave unscoped.
- **`userId` always comes from the session, never from the caller.** A
  function like `getExpenseById(expenseId)` takes the resource id as its
  only parameter — it does not also accept `userId`, so there is no call
  site that could (accidentally or otherwise) pass a different user's id.
- **A lookup by id is scoped by `_id` and `userId` in the same query**,
  exactly as `docs/auth.md` §5 specifies for mutations — never fetched by id
  alone with an ownership check applied afterward in application code. A
  document that exists but belongs to another user and a document that
  doesn't exist at all produce the same result: nothing found.
- **"Not found" and "not yours" are indistinguishable to the caller.** A
  `page.tsx` rendering a single resource (should a dynamic segment be added
  per `docs/routing.md` §6) calls `notFound()` when the scoped query returns
  nothing — it does not separately check "does this id exist for someone
  else" and render a different (403-shaped) state, which would leak which
  ids are valid.
- **Shared/system data is the one deliberate exception**, per `docs/auth.md`
  §5: `ExpenseCategory` reads may include `userId: null` system-default
  categories alongside the session's own — this is a read-only allowance and
  does not relax any rule for mutations.

## 5. Passing data to Client Components

- A data-fetching function returns a **DTO** (a plain object with only the
  fields a caller needs), not the raw Mongoose document. This is both a
  performance rule (`docs/best-practices.md` §3.6 — don't serialize fields
  nothing renders) and a security rule (`docs/security.md` §6 — don't cross
  the Server→Client boundary with more than the UI needs "just in case").
  `.lean()` on a Mongoose query already returns a plain object rather than a
  hydrated Document instance; trim it further to named fields where a
  document carries anything sensitive or irrelevant to the caller.
- Pass the same array/object reference to multiple children rather than
  precomputing multiple derived views in the Server Component and passing
  each — per `docs/best-practices.md` §3.2, the RSC boundary dedupes by
  reference, not value, so `expenses` and `expenses.toSorted(...)` would
  otherwise serialize the same data twice. Do the derived transform
  (`.filter()`, `.toSorted()`) inside the Client Component that needs it.
- Never forward `User.password` (already `select: false`,
  per `docs/auth.md` §2) or any other internal-only field through a DTO —
  a data-fetching function that touches `User` explicitly picks the fields
  a caller needs rather than spreading the whole document.

## 6. Performance patterns

These apply `docs/best-practices.md` §1 and §3 specifically to reads of this
app's resources — see those sections for the full reasoning; this is the
short version scoped to `Expense`/`ExpenseCategory`/`MonthlySummary`:

- **Parallelize independent reads.** A dashboard needing both the current
  month's `MonthlySummary` and the user's `ExpenseCategory` list starts both
  queries before awaiting either:

  ```ts
  const summaryPromise = getMonthlySummary(year, month);
  const categoriesPromise = getCategories();
  const [summary, categories] = await Promise.all([
    summaryPromise,
    categoriesPromise,
  ]);
  ```

- **Compose sibling sections as sibling async components** (per
  `docs/best-practices.md` §3.7) instead of one parent `await`-ing every
  section's data itself — each section's data-fetching function call
  becomes independently schedulable.
- **Stream slow sections behind `<Suspense>`** (per `docs/best-practices.md`
  §1.6 and `docs/routing.md` §7's `loading.tsx` guidance) rather than
  blocking an entire route on its slowest query — e.g. a category
  breakdown chart streams in while the page shell and faster sections paint
  immediately.
- **`React.cache()` for same-request dedupe only.** `verifySession()` is
  already wrapped in `React.cache()` (`docs/auth.md` §4) so every
  data-fetching function that calls it during the same render pass shares
  one session lookup. This is per-request memoization, not cross-request
  caching — see §7 for why this app doesn't add the latter yet.
- **Existing indexes already support the query shapes above** — `Expense`'s
  `{ userId: 1, date: -1 }` / `{ userId: 1, categoryId: 1 }` and
  `ExpenseCategory`'s `{ userId: 1, name: 1 }` (`docs/auth.md` §5) mean
  scoping every read by `userId` is the indexed access path, not an added
  cost.

## 7. Caching

This project does **not** enable Cache Components (`cacheComponents` is not
set in `next.config.ts`), so `"use cache"`/`cacheLife`/`cacheTag` are not
part of this app's data-fetching model today. This is a deliberate choice,
not an oversight: every read in scope (`Expense`, `ExpenseCategory`,
`MonthlySummary`) is personalized per `userId`, and a cached entry is only as
safe as its cache key — adopting `"use cache"` for these reads would require
auditing that `userId` is always part of the key for every cached function,
for no benefit yet, since MongoDB reads scoped by an indexed `userId` are
already fast (§6).

- Reads are uncached at the framework level; each request queries MongoDB
  directly through the indexed access path above.
- Per-request dedupe still happens via `React.cache()` (§6) — this is not
  "no caching," it's "no caching beyond a single render pass."
- Data a mutation changes is refreshed via `revalidatePath()`/
  `revalidateTag()` from the Server Action that performed the mutation, per
  `docs/data-mutations.md` §6 — this doc doesn't introduce a separate
  revalidation mechanism for reads.
- If a genuinely expensive, infrequently-changing read emerges later (e.g. a
  yearly report aggregating many months), revisit `cacheComponents` or an
  in-process LRU cache (`docs/best-practices.md` §3.4) then, scoped
  explicitly by `userId` in the cache key — don't adopt either preemptively.

## 8. Errors

A data-fetching function that fails (a MongoDB timeout, a malformed query)
is handled exactly per `docs/errors-and-validation.md` §3: the real error is
logged server-side and never returned to the caller as-is. Since these
functions run inside a Server Component rather than a Server Action, an
uncaught rejection is picked up by the nearest `error.tsx`
(`docs/routing.md` §7), which renders the generic `Alert` + "Try again"
pattern already specified there — a data-fetching function does not need its
own try/catch for a failure it has no meaningful fallback for; letting it
propagate to `error.tsx` is correct. Wrap in `try/catch` only where a
function can do something more specific than the route boundary already
does (e.g. `getExpenseById` returning `null` for "not found," which
`page.tsx` turns into `notFound()` rather than an error).

## 9. Non-goals

- No data fetching inside any `"use client"` component — no `useEffect` +
  `fetch`, no SWR/React Query call — against this app's own
  `Expense`/`ExpenseCategory`/`MonthlySummary`/`User` data. (This supersedes
  the hypothetical "live-refreshing Expenses table via `useSWR`" example in
  `docs/best-practices.md` §4.3 — that section documents the general pattern
  *if* client-side fetching were ever introduced; this doc is the
  authoritative answer that it isn't, for this app's own data, in v1.)
- No Route Handler created solely to hand data to this app's own UI — see
  `docs/routing.md` §9 and `docs/data-mutations.md` §1, which already draw
  this line for mutations; the same reasoning applies to reads.
- No `"use cache"` / Cache Components adoption in v1 — see §7.
- No component-level `Model.find()` calls scattered across `page.tsx` files
  in place of a named function in `app/lib/data/` — centralizing the query
  is what makes "does every read scope by `userId`" a one-directory
  grep-able audit instead of a repo-wide one (per the Next.js Data Access
  Layer guidance this project follows).
- No returning a raw Mongoose document (or `User.password`) across the
  Server→Client boundary — see §5.
