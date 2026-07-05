# React & Next.js Best Practices

Source: [vercel-labs/agent-skills — `react-best-practices/AGENTS.md`](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md)
(v1.0.0, Vercel Engineering). This doc adapts that guidance for this
repository: a production Next.js 16 (App Router) app using React 19, Server
Components/Server Actions, Mongoose/MongoDB, and NextAuth v4 (see
`docs/auth.md`) with a HeroUI-only UI (see `docs/ui.md`).

This is a **reference for how code should be written once a plan has been
approved** (`docs/ai-workflow.md` still governs *when* code gets written).
Rules are grouped by impact, matching the source document's priority order —
start with §1–2 (critical), then §3 (high) before spending time on §5–8.

---

## 1. Eliminating Waterfalls — CRITICAL

Sequential `await`s are the single biggest source of slow pages. Every rule
below is about making independent async work run concurrently instead of
one-after-another.

### 1.1 Check cheap conditions before async flags

If a branch needs `await someAsyncFlag()` **and** a cheap synchronous
condition, check the synchronous one first so the async call is skipped
entirely on the common failing path.

```ts
// Avoid: always awaits, even when categoryId is missing
const flag = await getFeatureFlag("bulk-import");
if (flag && categoryId) { /* ... */ }

// Prefer
if (categoryId) {
  const flag = await getFeatureFlag("bulk-import");
  if (flag) { /* ... */ }
}
```

### 1.2 Defer `await` until needed

Move an `await` into the branch that actually uses its result, so branches
that don't need it aren't blocked by it.

```ts
// Avoid
async function updateExpense(id: string, userId: string) {
  const category = await ExpenseCategory.findById(id); // always awaited
  if (!category) return { error: "Not found" };
  // ...
}

// Prefer: only fetch what the reached branch needs, in the order it's needed
```

### 1.3 Dependency-based parallelization

When operations have partial dependencies (B needs A's result, but C doesn't
need either), start every independent piece immediately rather than
serializing the whole chain. A library like [`better-all`](https://github.com/shuding/better-all)
automates this; the manual equivalent is starting promises eagerly and only
awaiting what a later step depends on:

```ts
const userPromise = verifySession();
const categoriesPromise = ExpenseCategory.find({ userId: null }); // system defaults, no dependency

const { userId } = await userPromise;
const [categories, expenses] = await Promise.all([
  categoriesPromise,
  Expense.find({ userId }),
]);
```

### 1.4 Prevent waterfall chains in Route Handlers / Server Actions

Start independent operations immediately, even before you're ready to await
them.

```ts
// Avoid: config waits on session, data waits on both
export async function GET() {
  const session = await getServerSession(authOptions);
  const config = await fetchConfig();
  const data = await fetchExpenses(session.user.id);
  return Response.json({ data, config });
}

// Prefer: kick off independent work in parallel
export async function GET() {
  const sessionPromise = getServerSession(authOptions);
  const configPromise = fetchConfig();
  const session = await sessionPromise;
  const [config, data] = await Promise.all([
    configPromise,
    fetchExpenses(session.user.id),
  ]);
  return Response.json({ data, config });
}
```

### 1.5 `Promise.all()` for independent operations

Never `await` two unrelated calls back-to-back — batch them.

```ts
// Avoid: 3 sequential round trips
const user = await getUser(userId);
const categories = await getCategories(userId);
const summary = await getMonthlySummary(userId, year, month);

// Prefer: 1 round trip
const [user, categories, summary] = await Promise.all([
  getUser(userId),
  getCategories(userId),
  getMonthlySummary(userId, year, month),
]);
```

### 1.6 Strategic Suspense boundaries

Don't `await` data at the top of an async Server Component if it blocks
unrelated UI (nav, layout chrome) from painting. Push the `await` down into
a child wrapped in `<Suspense>` so the shell renders immediately.

```tsx
// Avoid: whole page waits on the category breakdown
async function DashboardPage() {
  const summary = await getMonthlySummary(userId, year, month);
  return (
    <>
      <DashboardHeader />
      <CategoryBreakdown summary={summary} />
    </>
  );
}

// Prefer: header paints immediately, breakdown streams in
function DashboardPage() {
  return (
    <>
      <DashboardHeader />
      <Suspense fallback={<Skeleton />}>
        <CategoryBreakdown />
      </Suspense>
    </>
  );
}

async function CategoryBreakdown() {
  const summary = await getMonthlySummary(userId, year, month);
  return /* ... */;
}
```

Skip this pattern for small/fast queries, SEO-critical above-the-fold
content, or where the loading→content layout shift isn't worth the tradeoff.

---

## 2. Bundle Size Optimization — CRITICAL

### 2.1 Avoid barrel file imports

Import icon/component libraries with normal named imports and let Next.js's
built-in `optimizePackageImports` (on by default for common libraries since
13.5) transform them — don't hand-write deep import paths, which lose
TypeScript types for packages like `lucide-react` that don't ship `.d.ts`
files for subpaths.

```tsx
// This is fine in this Next.js version — the framework rewrites it
import { Plus, Trash2 } from "lucide-react";
```

If a UI dependency (e.g. an icon set alongside HeroUI, per `docs/ui.md` §2)
isn't in Next's default `optimizePackageImports` list, add it explicitly in
`next.config.ts`.

### 2.2 Conditional module loading

Only `import()` a large module when the feature that needs it is actually
activated (e.g. a CSV import/export feature for expenses), guarded by
`typeof window !== "undefined"` so it isn't pulled into the server bundle.

### 2.3 Defer non-critical third-party libraries

Anything that doesn't block the user's first interaction (analytics, error
reporting) loads after hydration via `next/dynamic` with `ssr: false`, not
eagerly in the root layout.

### 2.4 Dynamic imports for heavy components

Any component not needed on first render (e.g. a chart library or rich text
editor, if introduced later) is loaded with `next/dynamic`, not a static
top-level import.

### 2.5 Prefer statically analyzable import/file paths

Don't build the string passed to `import()` or `fs`/`path` calls from a
runtime variable — Next.js's file tracing and bundlers can't narrow what
they analyze, which widens server bundles and slows builds. Use an explicit
map of literal paths instead.

```ts
// Avoid
const mod = await import(`./pages/${pageName}`);

// Prefer
const PAGES = {
  dashboard: () => import("./pages/dashboard"),
  settings: () => import("./pages/settings"),
} as const;
const mod = await PAGES[pageName]();
```

### 2.6 Preload based on user intent

Preload a heavy bundle on `onMouseEnter`/`onFocus` of the control that opens
it (e.g. hovering the "Add expense" button before the modal's code has
loaded), rather than waiting for the click.

---

## 3. Server-Side Performance — HIGH

### 3.1 Authenticate Server Actions like API routes

This is already the load-bearing rule in `docs/auth.md` §5 — repeated here
because it's this document's single most important rule: **every** Server
Action calls `verifySession()` (or equivalent) itself. Middleware/Proxy
redirects and layout-level checks are UX, not security — a Server Action can
always be invoked directly.

```ts
"use server";
import { verifySession } from "@/app/lib/dal";

export async function deleteExpense(expenseId: string) {
  const { userId } = await verifySession();
  await Expense.deleteOne({ _id: expenseId, userId }); // ownership enforced in the query itself
}
```

### 3.2 Avoid duplicate serialization in RSC props

The RSC→client boundary deduplicates by object reference, not value. Passing
both `expenses` and `expenses.toSorted(...)` from a Server Component to a
Client Component serializes the data twice. Pass the original reference once
and do the transform (`.filter()`, `.toSorted()`, `.map()`) inside the Client
Component.

```tsx
// Avoid
<ExpenseTable expenses={expenses} sorted={expenses.toSorted(byDate)} />

// Prefer — sort inside the (client) ExpenseTable component
<ExpenseTable expenses={expenses} />
```

### 3.3 Avoid shared module state for request data

Never assign per-request data (the current session, the current user) to a
mutable module-level variable — concurrent renders in the same server
process can overwrite each other's data, leaking one user's session into
another user's response. Pass request-scoped values down as props/arguments,
exactly as `docs/auth.md`'s `verifySession()` pattern already does.

### 3.4 Cross-request LRU caching

`React.cache()` only dedupes within a single request. For data reused across
sequential requests within a short window (e.g. the same `MonthlySummary`
hit twice in a few seconds), an in-process `lru-cache` avoids a repeat
Mongoose query. Don't reach for this until there's an actual repeated-query
pattern to justify it.

### 3.5 Hoist static I/O to module level

Static assets — a logo used in a generated receipt/export, a config file
that doesn't change per request — are read once at module scope, not inside
every request handler.

```ts
// Avoid: re-reads the logo file on every request
export async function GET() {
  const logo = await fs.readFile("./public/logo.png");
  // ...
}

// Prefer: read once when the module loads
const logoPromise = fs.readFile("./public/logo.png");
export async function GET() {
  const logo = await logoPromise;
  // ...
}
```

### 3.6 Minimize serialization at RSC boundaries

Pass Client Components only the fields they use, not the entire Mongoose
document. This is the same instinct as the DTO pattern in `docs/auth.md`
§4 (secure checks) applied for payload size rather than security: a
`MonthlySummary` document has `byCategory`, `totalAmount`, timestamps, etc.
— a chart component that only needs `byCategory` should only receive that.

### 3.7 Parallel data fetching with component composition

Server Components fetch sequentially within a tree. Restructure sibling
sections (e.g. dashboard header + category breakdown) as sibling async
components rather than one component awaiting both fetches itself, so they
run concurrently.

```tsx
// Avoid: Sidebar's fetch waits on Page's fetch finishing first
export default async function Page() {
  const header = await fetchHeader();
  return (<><Header data={header} /><Sidebar /></>);
}

// Prefer: both fetch concurrently as independent components
async function Header() { const data = await fetchHeader(); return /* ... */; }
async function Sidebar() { const items = await fetchSidebarItems(); return /* ... */; }
export default function Page() { return (<><Header /><Sidebar /></>); }
```

### 3.8 Parallel nested data fetching

When mapping over a list to fetch nested data per item (e.g. expenses →
their categories), chain each item's dependent fetch inside that item's own
promise, so one slow item doesn't block the others.

```ts
// Avoid: one slow getCategory() blocks every item's author lookup
const expenses = await Promise.all(expenseIds.map(getExpense));
const withCategories = await Promise.all(expenses.map(e => getCategory(e.categoryId)));

// Prefer: each item's chain is independent
const withCategories = await Promise.all(
  expenseIds.map(id => getExpense(id).then(e => getCategory(e.categoryId))),
);
```

### 3.9 Per-request deduplication with `React.cache()`

Wrap `verifySession()`/`getCurrentUser()`-style functions in `React.cache()`
(already specified in `docs/auth.md` §4) so multiple components calling it
in the same render only hit the database once. Don't pass inline object
literals as arguments to a cached function — `React.cache()` uses reference
equality, so a fresh `{ id }` object on every call defeats the cache.

### 3.10 Use `after()` for non-blocking operations

Work that shouldn't delay the response — audit logging an expense deletion,
analytics — runs inside Next.js's `after()`, scheduled once the response has
been sent, not awaited inline before returning.

```ts
import { after } from "next/server";

export async function deleteExpense(expenseId: string) {
  const { userId } = await verifySession();
  await Expense.deleteOne({ _id: expenseId, userId });
  after(() => logAudit({ userId, action: "delete_expense", expenseId }));
}
```

---

## 4. Client-Side Data Fetching — MEDIUM-HIGH

### 4.1 Deduplicate global event listeners

If multiple component instances would each register the same
`window`/`document` listener (e.g. a keyboard-shortcut hook used on several
buttons), share one listener via a module-level registry or
`useSWRSubscription`, instead of one listener per instance.

### 4.2 Use passive event listeners for scrolling

Any `touchstart`/`wheel` listener that never calls `preventDefault()` (e.g.
analytics on scroll) should be registered with `{ passive: true }` so the
browser doesn't block scrolling waiting for it to finish.

### 4.3 Use SWR for automatic deduplication

For any client-side data fetching this app adds (e.g. live-refreshing the
Expenses table), use `useSWR` rather than a raw `fetch` in `useEffect` —
it dedupes identical in-flight requests across component instances and
handles revalidation/caching for free.

### 4.4 Version and minimize `localStorage` data

If a client preference is cached locally (e.g. a saved filter or the theme
override from `docs/ui.md` §2), prefix the key with a version
(`expense-tracker:filters:v1`) and store only the fields actually needed —
never a full user object, and never anything sensitive. Always wrap
`localStorage` access in `try/catch` (it throws in private browsing or when
quota is exceeded).

---

## 5. Re-render Optimization — MEDIUM

### 5.1 Calculate derived state during rendering

Don't store a value in `useState` and sync it via `useEffect` if it can be
computed directly from existing props/state during render (e.g. a filtered
expense total). Compute it inline instead of `setState` + effect.

### 5.2 Defer state reads to usage point

Don't call a subscribing hook (`useSearchParams`, a localStorage hook) at
the top of a component if the value is only read inside an event handler —
read it directly at that point (`new URLSearchParams(window.location.search)`)
so the component doesn't re-render on every unrelated change.

### 5.3 Don't wrap trivial primitive expressions in `useMemo`

`const isLoading = user.isLoading || categories.isLoading` doesn't need
`useMemo` — the memoization bookkeeping costs more than the expression.
Reserve `useMemo` for genuinely expensive computations.

### 5.4 Don't define components inside components

Defining a component inside another component's body creates a new
component type every render, forcing React to unmount/remount it (losing
state, re-running effects, resetting focus). Pass the data it needs as
props instead of nesting it for closure access.

```tsx
// Avoid
function ExpenseRow({ expense }: Props) {
  const CategoryChip = () => <Chip>{expense.category}</Chip>; // remounts every render
  return <div><CategoryChip /></div>;
}

// Prefer
function CategoryChip({ label }: { label: string }) {
  return <Chip>{label}</Chip>;
}
function ExpenseRow({ expense }: Props) {
  return <div><CategoryChip label={expense.category} /></div>;
}
```

### 5.5 Extract non-primitive default props to a constant

A `memo()`-wrapped component with `onClick = () => {}` as a default breaks
memoization, since a new function is created every render. Hoist the
default to a module-level constant.

### 5.6 Extract to memoized components

Move expensive per-item computation into its own `memo()`-wrapped
component so a parent's early return (e.g. a loading state) skips the work
entirely, instead of computing it in a `useMemo` that still runs even when
the result won't be rendered.

### 5.7 Narrow effect dependencies

Depend on the specific primitive field an effect uses (`user.id`), not the
whole object (`user`) — otherwise the effect re-runs on every unrelated
field change.

### 5.8 Put interaction logic in event handlers

A side effect triggered by a specific user action (submitting the add-expense
form, clicking delete) belongs in that handler, not modeled as
`state + useEffect` — the latter re-runs on unrelated re-renders and risks
duplicate execution.

### 5.9 Split combined hook computations

If a `useMemo`/`useEffect` bundles two independent computations with
different dependencies, split them so changing one dependency doesn't force
the other to recompute (e.g. filtering expenses by category shouldn't
recompute when only the sort order changes).

### 5.10 Subscribe to derived boolean state, not continuous values

Prefer `useMediaQuery('(max-width: 767px)')` over reading a continuously
changing `width` and deriving `isMobile` on every pixel change — subscribe
to the boolean, not the raw stream, matching the responsive breakpoints in
`docs/ui.md` §3.

### 5.11 Use functional `setState` updates

When new state depends on the previous value, use the updater-function form
(`setItems(curr => [...curr, next])`) instead of closing over the current
state variable — this avoids stale-closure bugs and keeps callbacks stable
across re-renders.

### 5.12 Use lazy state initialization

Pass a function to `useState` (`useState(() => buildIndex(items))`) for any
expensive initializer — without the function form it re-runs on every
render even though only the first result is used.

### 5.13 Use transitions for non-urgent updates

Wrap frequent, non-urgent state updates (e.g. tracking scroll position for a
sticky header) in `startTransition` so they don't block more urgent
rendering work.

### 5.14 Use `useDeferredValue` for expensive derived renders

For expensive filtering driven directly by a text input (e.g. searching
expense descriptions client-side), defer the derived value so typing stays
responsive while the filtered list renders when idle.

### 5.15 Use `useRef` for transient values

Values that change often but shouldn't trigger a re-render (mouse position,
a transient flag) belong in `useRef`, not `useState`.

---

## 6. Rendering Performance — MEDIUM

### 6.1 Animate the SVG wrapper, not the SVG element

Wrap an animated SVG (a loading spinner) in a `<div>` and apply the CSS
animation/transform to the wrapper — some browsers don't hardware-accelerate
transforms on SVG elements directly.

### 6.2 `content-visibility: auto` for long lists

For a long, scrollable list (e.g. a full expense history), apply
`content-visibility: auto` with a `contain-intrinsic-size` estimate to the
row so the browser skips layout/paint for off-screen rows.

### 6.3 Hoist static JSX elements

A JSX element with no dynamic content (a fixed skeleton/empty-state node)
can be declared once at module scope instead of being recreated on every
render of its parent.

### 6.4 Optimize SVG precision

If custom SVG icons/illustrations are added, run them through `svgo
--precision=1` to trim unnecessary coordinate precision and reduce file size.

### 6.5 Prevent hydration mismatch without flicker

For anything read from `localStorage`/cookies before hydration (e.g. the
theme override in `docs/ui.md` §2), don't gate it behind a `useEffect`
(causes a visible flash) or read it directly during SSR (throws — no
`localStorage` on the server). Use a small inline `<script>` that sets the
DOM attribute synchronously before hydration.

### 6.6 Suppress only expected hydration mismatches

`suppressHydrationWarning` is for values that are *intentionally* different
between server and client (a rendered timestamp). Don't use it to silence a
mismatch caused by an actual bug, and don't apply it broadly.

### 6.7 Use `<Activity>` for show/hide

For an expensive component that toggles visibility frequently (e.g. a
`Dropdown`'s menu content), wrap it in React's `<Activity mode="visible" |
"hidden">` to preserve its state/DOM across toggles instead of
unmounting/remounting.

### 6.8 Use `next/script` with the right `strategy`

Any third-party `<script>` uses `next/script` with an explicit `strategy`
(`afterInteractive` for most, `beforeInteractive` only when something
depends on it before hydration) — a plain blocking `<script>` tag delays
First Contentful Paint.

### 6.9 Use explicit conditional rendering

`{count && <Badge>{count}</Badge>}` renders a literal `0` when `count` is
`0`. Use `{count > 0 ? <Badge>{count}</Badge> : null}` whenever the
condition can be a falsy-but-renderable value.

### 6.10 Use React DOM resource hints

For known third-party endpoints (e.g. a future analytics or export service),
use `preconnect`/`prefetchDNS` in a Server Component so the browser starts
the connection before it's needed; use `preload`/`preinit` for critical
fonts/stylesheets.

### 6.11 Use `useTransition` over manual loading state

Prefer `useTransition`'s built-in `isPending` over a hand-rolled
`isLoading` `useState` — it resets correctly even if the transition throws,
and automatically supersedes a stale in-flight transition with a newer one.

---

## 7. JavaScript Performance — LOW-MEDIUM

Micro-optimizations for genuinely hot paths (large expense lists, frequent
loops) — don't apply these speculatively where the data size doesn't
warrant it.

- **Avoid layout thrashing**: don't interleave DOM style writes with layout
  reads (`offsetWidth`, `getBoundingClientRect()`) — batch all writes, then
  read once. Prefer toggling a CSS class over inline style + manual reads.
- **Build index maps for repeated lookups**: replace repeated
  `array.find()` calls keyed by id with a `Map` built once
  (`new Map(categories.map(c => [c._id, c]))`), turning O(n) lookups into
  O(1) — relevant once expense lists reference categories by id in a loop.
- **Cache property access in loops**: hoist a repeated nested property
  read (`obj.config.settings.value`) out of a loop instead of re-reading it
  each iteration.
- **Cache repeated function calls**: memoize a pure function called
  repeatedly with the same input during a render pass (e.g. formatting the
  same category name many times) in a module-level `Map`.
- **Cache Storage API calls**: `localStorage`/`document.cookie` reads are
  synchronous and comparatively expensive — cache them in memory and
  invalidate on the `storage` event or tab visibility change.
- **Combine multiple array iterations**: replace several separate
  `.filter()` passes over the same array with one loop that buckets items
  in a single pass.
- **Defer non-critical work with `requestIdleCallback`**: schedule
  analytics/telemetry/prefetching during idle time rather than synchronously
  inside a user-triggered handler.
- **Early length check for array comparisons**: before an expensive
  sort-and-compare equality check, bail out immediately if the two arrays'
  lengths differ.
- **Early return from functions**: return as soon as a result is known
  (e.g. form validation) instead of continuing to process remaining items.
- **Hoist `RegExp` creation**: build regexes at module scope (or memoize
  with `useMemo` if they depend on props) instead of constructing a new one
  every render; remember global (`/g`) regexes carry mutable `lastIndex`
  state.
- **Use `flatMap` to map and filter in one pass**: replace
  `.map(x => cond ? x : null).filter(Boolean)` with a single `.flatMap()`.
- **Use a loop for min/max instead of `sort()`**: finding the latest/oldest
  expense needs one O(n) pass, not an O(n log n) sort.
- **Use `Set`/`Map` for O(1) membership checks**: replace
  `array.includes()` inside a `.filter()`/loop with a `Set`.
- **Use `toSorted()` instead of `sort()`**: `.sort()` mutates in place,
  which is unsafe against React props/state (`users.sort(...)` mutates the
  prop array a parent passed down). Use the immutable `.toSorted()` (or
  `[...arr].sort()` if targeting older runtimes).

---

## 8. Advanced Patterns — LOW

Narrow, situational patterns — apply only when the specific situation
described actually arises.

- **Don't put Effect Events in dependency arrays**: a function returned by
  `useEffectEvent` intentionally has an unstable identity every render;
  keep it out of the effect's dependency array and depend only on the
  actual reactive values the effect uses.
- **Initialize app-wide setup once, not per mount**: one-time
  initialization (e.g. checking an auth token on load) that must run
  exactly once per app load belongs behind a module-level guard flag, not
  inside a component's `useEffect([])`, since components can remount.
- **Store event handlers in refs / use `useEffectEvent`**: when a
  subscription effect shouldn't re-subscribe every time a callback prop
  changes, wrap the callback with `useEffectEvent` (or a ref) so the effect
  depends only on stable values like the event name.
- **`useEffectEvent` for stable callback refs**: the general form of the
  above — read the latest value of a prop/callback inside an effect without
  adding it to the dependency array, avoiding both stale closures and
  unnecessary effect re-runs.

---

## Applying this doc

- New code in this repo should default to the patterns above; existing code
  isn't retroactively rewritten just to satisfy a rule with no observed
  problem.
- If a rule's example above doesn't fit this project's stack 1:1 (e.g. no
  chart library is in scope yet), treat the underlying principle as what
  applies, not the literal snippet.
- Where this doc and `docs/auth.md` overlap (Server Action auth, per-request
  data isolation), `docs/auth.md` is the authoritative source for the
  security requirement; this doc's §3.1/§3.3 restate it for the performance
  framing but don't relax it.
