# Authentication — Personal Expense Tracker

This document specifies the authentication, session, and access-control
architecture for the app, built on **NextAuth.js v4** (the current stable
release line — v5/Auth.js is still in beta and is intentionally not used
here). NextAuth owns authentication, session issuance/verification, and
cookie security — the app never implements its own crypto, token signing, or
session storage.

Domain context (see `models/`): `User` holds `name`, `email` (unique), and a
`select: false` hashed `password`. `Expense`, `ExpenseCategory`, and
`MonthlySummary` all key off `userId`. Every rule in this doc exists to
guarantee that a request authenticated as user A can never read or mutate a
document belonging to user B.

## 1. Principles

- **NextAuth is the only auth system.** Session tokens, cookie flags, CSRF
  protection for its own endpoints, and credential verification flow through
  NextAuth's APIs — never hand-rolled JWT signing or a parallel session table.
- **Protected by default.** Every route under `app/*` requires an
  authenticated session unless it's explicitly listed as public. Adding a new
  route never requires remembering to protect it — it requires remembering to
  *exempt* it, which is the safer default.
- **Defense in depth.** Route-level redirects (Proxy) are a UX convenience,
  not a security boundary. The real enforcement happens per-request in Server
  Components, Server Actions, and Route Handlers, and again at the database
  query itself. All three layers check identity independently.
- **Ownership is never trusted from the client.** A request body or URL param
  can claim any `expenseId` or `categoryId` it wants. The server derives
  `userId` exclusively from the verified session and uses it to scope every
  read and every write — client-supplied user identifiers are never accepted.

## 2. Provider & session strategy

- **Package**: `next-auth@^4` (latest stable 4.x). Do not use the `next-auth@beta`
  (v5/Auth.js) line — its API (top-level `auth()`, Server Action-native
  `signIn`) is a different shape from what's documented here and is not yet
  stable.
- **Credentials provider.** Auth is email + password against the existing
  `User` model, not a third-party OAuth identity — so NextAuth is configured
  with the `Credentials` provider.
- **JWT session strategy.** NextAuth v4 does not support database sessions
  with the `Credentials` provider (this is enforced by NextAuth itself, not a
  choice made here) — sessions must use `session: { strategy: "jwt" }`. The
  session is a signed, `httpOnly` cookie containing the minimum claims needed
  to identify the user (`sub`/`userId`) — no email, name, or other PII beyond
  what's needed for display.
- **Password verification.** The `authorize()` callback looks up the user by
  email (must explicitly `.select("+password")` since the schema marks it
  `select: false`), compares the submitted password with `bcrypt.compare`,
  and returns only `{ id, name, email }` on success — never the password hash.
- **Password storage.** Passwords are hashed with `bcrypt` (cost factor ≥ 12)
  before being written to `User.password` at signup. Plaintext passwords are
  never logged, stored, or included in any response.

## 3. File layout

| File | Responsibility |
|---|---|
| `lib/auth.ts` | NextAuth v4 config object: `export const authOptions: NextAuthOptions = { ... }` — `Credentials` provider, JWT session, `pages.signIn`, callbacks. |
| `app/api/auth/[...nextauth]/route.ts` | `const handler = NextAuth(authOptions); export { handler as GET, handler as POST };` — the only auth HTTP surface. |
| `proxy.ts` (project root) | Optimistic route protection — see §4. In Next.js 16 this file replaces the deprecated `middleware.ts`; it must be named `proxy.ts` and export a `proxy` function. |
| `app/lib/dal.ts` | Data Access Layer — `verifySession()` / `getCurrentUser()`, the single place secure (non-optimistic) auth checks happen, via `getServerSession(authOptions)`. |
| `app/actions/auth.ts` | Server Action for signup only (hash + create `User`). Login and logout are client-side calls to `signIn`/`signOut` from `next-auth/react` — see §6. |

### Environment variables

- `NEXTAUTH_SECRET` — random 32-byte secret (`openssl rand -base64 32`) used
  to sign session JWTs. Required in all environments, never committed.
- `NEXTAUTH_URL` — the canonical URL of the deployment (e.g.
  `https://expenses.example.com`, or `http://localhost:3000` in dev). Unlike
  the v5 beta, v4 does not reliably auto-detect this in all deployment
  targets — set it explicitly rather than relying on inference.
- `MONGODB_URI` — already present in `.env.example`; unchanged by this doc.

## 4. Route protection

### Default posture

Every path under `app/*` is protected unless it appears in an explicit public
allowlist. The allowlist is intentionally short:

```
/login
/signup
/api/auth/*   (NextAuth's own endpoints — must remain reachable pre-auth)
```

Everything else — the dashboard, expenses, categories, settings, and any
route added later — requires a valid session with no further action from
whoever adds the route.

### Proxy (optimistic checks)

`proxy.ts` runs on (almost) every request and performs a **cookie-only**
check via `getToken` (the same edge-compatible primitive NextAuth v4 uses
internally in its own `withAuth` middleware helper) — it does not query the
database. This is the pattern Next.js recommends for Proxy: cheap checks
only, since Proxy also runs on prefetched routes.

```ts
// proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const publicRoutes = ["/login", "/signup"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const isAuthed = !!token;

  if (!isAuthed && !isPublicRoute) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthed && isPublicRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except static assets and the auth API itself
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

`getToken` reads and verifies the JWT straight from the cookie without a
database round trip, so this satisfies Proxy's "cheap checks only"
constraint while still being a real signature-verified check, not just
"does a cookie exist."

### Secure checks (the real boundary)

Proxy redirects improve UX (no flash of protected content, clean
`callbackUrl` round-trip) but a redirect is not a security control — Server
Actions and Route Handlers can still be invoked directly, and static/prefetch
edge cases exist. The binding check is the Data Access Layer:

```ts
// app/lib/dal.ts
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const verifySession = cache(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  return { userId: session.user.id };
});
```

Every Server Component that reads user data, every Server Action that
mutates it, and every Route Handler calls `verifySession()` first and uses
the returned `userId` — never a `userId` read from `formData`, query params,
or the request body. `cache()` ensures this only runs once per render pass
regardless of how many components call it (as recommended by the Next.js
Data Access Layer pattern for this version). `getServerSession` must always
be called with the same `authOptions` object used to configure the
`[...nextauth]` route — a mismatched or re-declared options object is a
common source of "session is always null" bugs in v4.

## 5. Per-user data isolation

Identity is enforced twice, independently: once in the server code that
issues the query, and once in the query itself. Either layer failing alone
must not be sufficient to leak or mutate another user's data.

### Server level

- Every data-fetching function takes its `userId` from `verifySession()`,
  never from a function argument supplied by a route param or client input.
- Route Handlers and Server Actions that accept a resource ID (e.g.
  `expenseId`) always pair it with the session's `userId` in the same query —
  they do not fetch by ID alone and check ownership afterward in application
  code, which is easy to forget in a new code path. The query itself should
  be incapable of returning another user's document.

### Database level

- **Reads** always filter by `userId`, in addition to whatever other filter
  applies:

  ```ts
  Expense.find({ userId, categoryId }) // never Expense.find({ categoryId })
  ```

- **Mutations** (update/delete) filter by both `_id` and `userId` in the same
  operation, so an attempt to modify another user's document simply matches
  zero rows instead of relying on a separate "is this mine?" check:

  ```ts
  Expense.findOneAndUpdate({ _id: expenseId, userId }, update);
  Expense.deleteOne({ _id: expenseId, userId });
  ```

  A zero-match result is treated as "not found," not "forbidden" — the API
  does not distinguish "doesn't exist" from "exists but isn't yours," which
  avoids leaking which IDs are valid.

- **Existing indexes already support this pattern**: `Expense`'s
  `{ userId: 1, date: -1 }` and `{ userId: 1, categoryId: 1 }`, and
  `ExpenseCategory`'s `{ userId: 1, name: 1 }`, all lead with `userId`, so
  scoping every query by it is also the indexed access path, not a
  performance tax.
- **Shared/system data is the one deliberate exception**: `ExpenseCategory`
  documents with `userId: null` are system defaults, readable by every
  authenticated user but never writable or deletable by any of them —
  category mutation endpoints must reject any request targeting a document
  where `userId` is `null` or does not match the session, even though reads
  are allowed to include it.
- **`MonthlySummary`** is looked up by the compound `{ userId, year, month }`
  key — the same rule applies: `userId` always comes from the session, never
  from the request.

## 6. Session lifecycle

NextAuth v4's `signIn`/`signOut` helpers are exported from `next-auth/react`
and are **client-only** — unlike the v5 beta, v4 has no server-action-native
sign-in call. This shapes the login/signup flow:

- **Login**: `/login` is a Client Component form. On submit it calls
  `signIn("credentials", { email, password, redirect: false })`, checks
  `result.error` and surfaces a generic "Invalid email or password" message
  (never revealing whether the email exists), and on success calls
  `router.push` to the `callbackUrl` (or `/`).
- **Signup**: a Server Action validates input (name/email/password, mirroring
  the `User` schema's constraints), checks for an existing email, hashes the
  password, and creates the `User`. The signup form is a Client Component
  that calls this Server Action, and on success immediately calls
  `signIn("credentials", { email, password, redirect: false })` client-side
  so the user isn't asked to log in again right after registering, then
  redirects.
- **Logout**: a `Button` in the nav calls `signOut({ callbackUrl: "/login" })`
  from `next-auth/react`; NextAuth clears the session cookie server-side.
- **Session access on the client**: only add `<SessionProvider>` (wrapping
  the app in a small Client Component in `app/layout.tsx`) if some Client
  Component genuinely needs reactive `useSession()` state that can't be
  passed down as a prop. Since this app fetches user-specific data in Server
  Components by default (§4, §5), prefer passing already-resolved data down
  as props and skip the global provider unless a specific interactive
  component requires it.
- **Expiry**: session JWTs expire on a fixed max age (recommend 30 days) with
  sliding renewal on activity, matching NextAuth v4's default JWT session
  behavior (`session.maxAge`, default 30 days). There is no "remember me"
  toggle in v1 — a single session lifetime is used everywhere.
- **Cookie flags**: NextAuth sets `httpOnly`, `sameSite: lax`, and (in
  production, when `NEXTAUTH_URL` is `https`) `secure` automatically for its
  session cookie — the app does not set or read this cookie manually
  anywhere.

## 7. CSRF / XSS

- NextAuth v4's `Credentials` sign-in endpoint has built-in CSRF token
  verification (a `csrfToken` is fetched and submitted automatically by the
  `signIn()` client helper); the app does not need to implement its own for
  the auth endpoint.
- Server Actions get Next.js's built-in origin-check CSRF protection
  automatically — mutations are only ever exposed as Server Actions or
  same-origin Route Handlers, never as a GET request that mutates state.
- Session data is only ever read server-side via `getServerSession`/
  `verifySession()`. Client-side session access, if used at all, goes through
  `useSession()` under a `SessionProvider` — the raw JWT is never parsed or
  exposed to client JavaScript directly.

## 8. Security checklist

- [ ] `NEXTAUTH_SECRET` is set from a real random value in every environment
      and absent from version control.
- [ ] `NEXTAUTH_URL` is set explicitly per environment rather than relying on
      auto-detection.
- [ ] `User.password` keeps `select: false`; every query that needs it
      explicitly opts in with `.select("+password")`, and the hash never
      appears in any API response or Server Component prop.
- [ ] Passwords are hashed with `bcrypt` before storage; never compared or
      stored as plaintext.
- [ ] `proxy.ts` covers every non-public route (verify the `matcher` excludes
      only static assets and `api/auth`, not other API routes).
- [ ] Every Server Component/Action/Route Handler that touches `Expense`,
      `ExpenseCategory`, or `MonthlySummary` calls `verifySession()` first.
- [ ] Every database read/write scoped to those collections includes
      `userId` in the query filter itself — grep for `Expense.find`,
      `.findOneAndUpdate`, `.deleteOne`, etc. and confirm none omit it.
- [ ] Category mutation endpoints reject writes targeting `userId: null`
      (system default) categories.
- [ ] Generic error messages on login ("Invalid email or password") never
      distinguish a missing account from a wrong password.
- [ ] Rate limiting or backoff on `/api/auth/callback/credentials` is in
      place before production launch (NextAuth does not provide this itself).

## 9. Non-goals

- No custom JWT signing, cookie parsing, or session table — NextAuth owns all
  of it.
- No OAuth/social login in this scope (Credentials only); adding a provider
  later is additive and shouldn't require revisiting this doc's isolation
  rules.
- No client-side-only authorization checks as a substitute for server/DB
  enforcement — hiding a button is UX, not access control.
- No upgrade to NextAuth v5/Auth.js until it reaches a stable release; this
  doc will be revised at that point rather than mixing v4/v5 APIs.
