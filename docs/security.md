# Security — Secrets, Environment, and Deployment

This document covers secrets, environment variable management, and safe
deployment for this project. It complements — and doesn't repeat —
`docs/auth.md` (session/identity security) and `docs/errors-and-validation.md`
(what's safe to show a user). The rule underneath all three: **nothing
internal — a credential, a stack trace, a raw database error — ever reaches
a place an unintended audience can read it.**

## 1. Principles

- **No secret ever appears in source code, git history, a client-side
  bundle, or a log.** If a value grants access to something (a database, an
  API, a signed session), it lives only in an environment variable, and only
  server-only code ever reads it.
- **Secrets come from the deployment platform's environment variable
  store, never from a committed file.** `.env.example` documents which
  variables exist; it never contains a real value.
- **Assume anything reachable from a Client Component is public.** Next.js
  only inlines `NEXT_PUBLIC_*` variables into the client bundle, but the
  real rule is broader: any data that crosses into client-rendered code or
  HTML is visible to anyone via "View Source" or dev tools, regardless of
  variable naming.
- **Defense in depth.** A developer's own diligence is the first layer, not
  the only one — `.gitignore`, environment-specific credentials, and
  (recommended, §9) automated secret scanning all backstop each other.

## 2. What counts as a secret here

| Value | Where it lives | Sensitivity |
|---|---|---|
| `MONGODB_URI` | env var | Contains a database username/password — full read/write access to all user data |
| `NEXTAUTH_SECRET` | env var | Signs session JWTs (`docs/auth.md` §2) — anyone with it can forge a valid session for any user |
| `NEXTAUTH_URL` | env var | Not sensitive itself, but must be correct per environment |
| `User.password` | database (hashed) | Never a plaintext secret in transit/storage, but still never logged or forwarded — `select: false` in the schema |
| Any future third-party API key (email, analytics, payments) | env var | Same treatment as `MONGODB_URI`/`NEXTAUTH_SECRET` — add it to this table when it's introduced |

## 3. Environment variable management

- **`.env.example` is the only env file committed.** It lists variable
  *names* with obviously-fake placeholder values (the current
  `MONGODB_URI=mongodb://<username>:<password>@...` is correct practice) —
  never a real credential, and never a "redacted" real value, which can be
  easier to reverse-engineer than an honestly fake one.
- **Every other env file is gitignored.** This repo's `.gitignore` already
  has the right pattern:
  ```
  .env*
  !.env.example
  ```
  This pattern is load-bearing — never narrow it, remove it, or add an
  exception for a new `.env.*` variant without deliberately confirming that
  variant should actually be committed (it almost never should).
- **New required env var → update `.env.example` in the same change.**
  When a Server Action, Route Handler, or config needs a new variable, add
  its name (with a placeholder) to `.env.example` in the same commit — the
  example file should always list exactly what a fresh clone needs to run,
  never more, never less.
- **Fail fast on a missing required variable.** Don't let a missing secret
  resolve to `undefined` and silently misbehave. `lib/mongodb.ts` already
  does this correctly:
  ```ts
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }
  ```
  Apply the same pattern to every new required secret (`NEXTAUTH_SECRET`,
  future API keys) — an explicit startup error is much safer than a
  half-working app that quietly skips auth or writes to the wrong database.
- **Each environment gets its own values.** Local dev, CI, preview, and
  production never share the same `MONGODB_URI`/`NEXTAUTH_SECRET` — a
  compromised laptop or a leaked local `.env.local` should never be able to
  reach production data.

### Public vs. private variables in Next.js

- Only variables explicitly prefixed `NEXT_PUBLIC_` are inlined into the
  client JavaScript bundle; everything else is server-only by default. This
  is enforced by the framework, not a convention to trust blindly — but the
  practical rule for this project is: **never prefix a secret with
  `NEXT_PUBLIC_`**, and never treat a non-prefixed variable as reachable
  from a `"use client"` file (it will be `undefined` there — that's the
  framework protecting you, not a bug to route around).
- Before adding any `NEXT_PUBLIC_*` variable, confirm out loud that the
  value is fine for literally any visitor to read in their browser's dev
  tools. If there's any doubt, it isn't a `NEXT_PUBLIC_` variable.

## 4. Secret storage by environment

- **Local development**: `.env.local`, gitignored, using dev-scoped
  credentials (a local MongoDB instance or a restricted dev-tier Atlas
  cluster) — never a copy of production credentials on a developer's
  machine.
- **CI** (if/when configured): secrets live in the CI provider's encrypted
  secret store (e.g. GitHub Actions repository/environment secrets),
  injected as env vars at run time. Never place a real value directly in a
  workflow YAML file.
- **Production/staging deployment** (e.g. Vercel): secrets are set through
  the platform's environment variable dashboard or CLI (`vercel env add`),
  scoped correctly to Production vs. Preview vs. Development — never pasted
  into a shared doc, chat message, issue, or PR description.
- **Rotation**: any secret suspected of exposure — accidentally committed,
  shared over an insecure channel, held by someone who's left the project —
  is rotated immediately: regenerate the MongoDB user's password and/or
  `NEXTAUTH_SECRET`. Rotating `NEXTAUTH_SECRET` naturally invalidates all
  existing sessions, which is the correct, safe side effect.

## 5. Never hardcode secrets

- No literal connection string, API key, token, or credential ever appears
  as a string literal anywhere in the repo — not in application code, not
  in a config file, not in a test fixture, not in a comment, not "just
  temporarily for testing."
- The only literal-looking credential strings allowed in the repo are the
  obviously-fake placeholders in `.env.example`.
- If a secret is ever accidentally committed, **rotating it is mandatory —
  removing it from a later commit is not sufficient.** It remains in git
  history (and any existing clone, fork, or CI log) regardless of later
  commits. See §10.

## 6. Never expose sensitive data client-side

- Secrets and full database records are only ever touched in Server
  Components, Server Actions, and Route Handlers. Data crossing into a
  Client Component is trimmed to exactly the fields that component needs
  (the same discipline as `docs/best-practices.md` §3.6, but a security
  requirement here, not a payload-size one) — never forward a full
  Mongoose document "just in case" the client needs more later.
- `User.password` stays `select: false` at the schema level (already the
  case — see `docs/auth.md` §2). Any query that opts in with
  `.select("+password")` uses the result only for the `authorize()`
  comparison and forwards it nowhere else — not into a session payload, a
  log line, or a prop.
- Never put a secret in a `NEXT_PUBLIC_*` variable, an inline `<script>`, a
  data attribute, or a hidden form field — anything rendered into HTML or
  bundled into client JS is visible to any visitor.
- Client-facing error messages and logs never include a secret, an API
  token, session JWT contents, or a raw database error. This is the same
  boundary `docs/errors-and-validation.md` draws for stack traces and
  internal detail — here it's explicitly a security control, not just UX
  polish, since a raw MongoDB error string can reveal schema/query shape
  useful to an attacker.

## 7. Logging discipline

- Never log a full request body, a full `User`/session object, or an
  `Authorization` header. A log aggregator (Vercel's logs, or whatever is
  added later) is just another place a secret can leak from once logged —
  logging isn't exempt from the "no secrets outside env vars" rule.
- Server-side `console.error` calls (per `docs/errors-and-validation.md`
  §3) log the caught error's message/stack for debugging — never the raw
  input payload that produced it, unless it's been stripped of
  `password`/token-shaped fields first.
- If structured logging or a third-party log aggregator is introduced,
  confirm before enabling it that it doesn't capture request
  bodies/headers by default, and add explicit redaction for known-sensitive
  field names (`password`, `token`, `secret`, `authorization`, `cookie`)
  before it ships.

## 8. Safe deployment practices

- Deploy only from the repository's actual commit history — no manual
  edits made directly against a production dashboard/environment that
  don't exist in git. Undocumented drift is itself a security risk (an
  unreviewed, unrecorded change).
- **Environment parity**: the same variable *names* (per `.env.example`)
  are required in every environment. A deploy missing one should fail the
  build/boot loudly (§3), not degrade silently into a broken or insecure
  state.
- **Least privilege for infrastructure credentials**: the MongoDB user in
  `MONGODB_URI` has only the permissions this app actually needs
  (read/write on its own database) — never an admin/root account reused
  from another project or a personal account.
- **Dependency hygiene**: `package-lock.json` is committed for reproducible
  installs. Run `npm audit` periodically. A new dependency that itself
  requires an API key/secret follows this doc's storage guidance for that
  secret before it's wired in — it doesn't get a pass because it's "just a
  library."
- **HTTPS only in production**: NextAuth's `secure` cookie flag
  (`docs/auth.md` §6) depends on the deployment genuinely being served over
  HTTPS. Don't deploy anywhere that terminates production traffic over
  plain HTTP.
- **CI/CD logs are not a safe place for secrets**: never add a step that
  echoes or prints an environment variable to build output
  (`echo $NEXTAUTH_SECRET`), even temporarily for debugging — build logs
  are frequently readable by a wider audience than the secret store itself.

## 9. Preventing accidental commits

- Before committing, review `git status`/`git diff` for anything that
  looks like a credential — including in files that seem unrelated (a
  pasted `curl` command, a debug `console.log`, a config file with a
  filled-in default instead of a placeholder).
- Keep the `.gitignore` `.env*` / `!.env.example` pair intact. If a new
  kind of local secret file is introduced later (e.g. a service-account
  JSON key), add it to `.gitignore` in the same change that introduces it —
  before the file is ever created locally.
- Consider adding automated secret scanning (e.g. `gitleaks` or
  `trufflehog`) as a pre-commit hook or CI step once CI is set up
  (`CLAUDE.md` notes none is configured yet) — this is a recommended
  backstop, not a substitute for the discipline above.
- **If you are Claude Code, or any AI assistant, working in this repo**:
  never print the contents of `.env.local` or any secret's actual value
  into chat, a commit message, a code comment, or a written file. Confirming
  that a variable *name* is set (or reading `.env.example`'s placeholder
  values) is fine; echoing a real value anywhere is not.

## 10. Incident response: if a secret is exposed

If a secret is committed, logged, or otherwise exposed:

1. **Rotate it immediately at the source** (MongoDB Atlas user password,
   regenerate `NEXTAUTH_SECRET`, revoke/reissue a third-party API key) —
   before anything else.
2. **Update the new value everywhere it's used**: local `.env.local`, CI
   secrets, every deployment environment.
3. **Treat any git-committed exposure as permanent in that repository's
   history.** Removing it in a later commit does not undo the fact that it
   was already distributed to clones, forks, and CI logs. Rotation is the
   actual fix — history rewriting is not a substitute for it (and rewriting
   shared history has its own risks — see the git safety guidance already
   in place for this environment).
4. Where feasible, check the credential provider's access logs (e.g.
   MongoDB Atlas) for any unexpected activity during the exposure window.

## 11. Non-goals

- Session/auth mechanics are `docs/auth.md`'s scope, not this doc's —
  covered here only where they touch a stored secret (`NEXTAUTH_SECRET`).
- Input validation and user-facing error content are
  `docs/errors-and-validation.md`'s scope.
- No dedicated secrets-management service (Vault, AWS Secrets Manager, etc.)
  is in scope at this project's current size — the deployment platform's
  built-in environment variable store is sufficient. Revisit only if the
  project's infrastructure genuinely grows to need it.
