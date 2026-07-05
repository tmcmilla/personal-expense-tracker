# Errors & Validation — Personal Expense Tracker

This document specifies how errors are surfaced to users and how input is
validated throughout the app. Two rules anchor everything else here:

1. **No user ever sees a stack trace, a raw exception message, a database
   error string, or any other internal detail.** Every user-facing error is
   a short, plain-language sentence, and every one of them renders in a
   HeroUI `Alert` (`color="danger"`) — never a raw `<p>`, a `console.error`
   leaking into the UI, or a framework's default error overlay in
   production.
2. **All input validation — client and server — is defined once, with Zod,
   and reused.** Zod schemas are the single source of truth for what
   "valid" means for a given input; nothing is hand-validated with ad hoc
   `if` checks that can drift from what the schema says.

This complements `docs/ui.md` (component choices), `docs/auth.md` (auth-
specific error messages, e.g. never revealing whether an email exists), and
`docs/routing.md` (`error.tsx` boundaries per route segment).

## 1. Error display: HeroUI `Alert`, always

Every visible error message in this app renders in a HeroUI `Alert`. This
is deliberately simpler than treating "how urgent is this error" as a
factor in which component shows it — `docs/ui.md` §4 uses `Alert` for
every error, from a failed page-level data fetch down to a failed delete
inside a modal, and reserves `Toast` for success confirmations only. A
`Toast` auto-dismisses; an error the user may need to read, retry, or act
on should not disappear on its own.

### Where an `Alert` appears, by scope

| Scope | Placement | Example |
|---|---|---|
| Page/section load failure | `Alert` in place of the section's content (not layered over a `Skeleton`) | Dashboard's category breakdown failed to load |
| Form-level failure (not tied to one field) | `Alert` inside the form's `Card`/`ModalBody`, above the fields | Login failed, duplicate category name, expense save rejected by the server |
| Action failure outside a form (delete, from a table row menu) | `Alert` inside the confirmation `Modal` that triggered the action | Deleting a category that's referenced elsewhere fails unexpectedly |
| Route-level crash | `error.tsx`'s content itself is a centered `Alert` + a "Try again" `Button` calling the `reset()` prop `error.tsx` receives | An uncaught exception in a Server Component |

An `Alert`'s text is never the raw error. A caught exception is mapped to
one of a small set of user-facing strings (§3) before it reaches the
`Alert` — the actual `Error` object, its `message`, and its stack are
logged server-side (`console.error`, or whatever logging is wired up later)
and never serialized into anything sent to the client.

### What doesn't change

Field-level validation feedback (a single `Input`/`Select`/`DatePicker`
showing `isInvalid` + its own `errorMessage`) is not an `Alert` — it's the
input's own built-in error slot, and stays that way per `docs/ui.md` §4.
That's a deliberate, narrower UX pattern (the error sits next to the field
it's about, and HeroUI wires up `aria-describedby` automatically) — it is
not in tension with "every visible error message uses `Alert`," because a
field's inline `errorMessage` is part of the field, not a standalone
message. Anything that isn't scoped to one specific input — a failed
submission, a server rejection, a business-rule violation spanning multiple
fields — is exactly what the `Alert` rule covers.

## 2. Validation with Zod

### Where schemas live

One Zod schema per resource shape, colocated with the Server Actions that
use it:

```
app/lib/validation/
  expense.ts       # expenseSchema, expenseUpdateSchema
  category.ts       # categorySchema
  auth.ts           # signupSchema, loginSchema
```

A schema is written once and imported everywhere that shape needs
validating — a Server Action, a Route Handler, and (for immediate
client-side feedback) the form itself all import the *same* schema object,
never a hand-copied re-implementation of its rules.

```ts
// app/lib/validation/expense.ts
import { z } from "zod";

export const expenseSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  categoryId: z.string().min(1, "Choose a category"),
  date: z.coerce.date(),
  description: z.string().trim().max(500, "Keep it under 500 characters").optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
```

`z.infer` derives the TypeScript type from the schema — the type and the
runtime validation can never drift apart because there's only one
definition.

### Server-side validation is mandatory, client-side is a convenience

Per `docs/best-practices.md` §3.1, a Server Action is a public endpoint —
it validates with the full Zod schema itself, regardless of whatever the
client already checked. Client-side validation (real-time `isInvalid`
feedback as the user types) exists purely to give faster feedback; it is
never trusted as the actual guarantee.

```ts
// app/actions/expenses.ts
"use server";

import { expenseSchema } from "@/app/lib/validation/expense";
import { verifySession } from "@/app/lib/dal";

export async function createExpense(input: unknown) {
  const { userId } = await verifySession();

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { amount, categoryId, date, description } = parsed.data;
  await Expense.create({ userId, amount, categoryId, date, description });
  return { success: true };
}
```

`safeParse` — never bare `parse()` inside a Server Action — so a validation
failure is a normal return value the caller handles, not a thrown exception
that has to be caught and translated into a user-facing message every time.

### Mapping Zod errors onto HeroUI inputs

`parsed.error.flatten().fieldErrors` returns `{ fieldName: string[] }`. Map
that directly onto each field's `isInvalid`/`errorMessage`:

```tsx
"use client";

const [state, formAction] = useActionState(createExpenseAction, undefined);

<Input
  name="amount"
  label="Amount"
  isInvalid={!!state?.fieldErrors?.amount}
  errorMessage={state?.fieldErrors?.amount?.[0]}
/>
```

Only the first message per field is shown (matching a single `Input`'s
single `errorMessage` slot) — Zod's per-field arrays exist for schemas with
multiple stacked rules per field, not for the UI to enumerate all of them
at once.

### Cross-field and business-rule validation

Rules that don't belong to one field (password confirmation, "this
category name is already in use for this user") use Zod's `.refine()`/
`.superRefine()` with an explicit `path`, so the error still resolves to a
specific field's `errorMessage` where one exists:

```ts
export const signupSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
```

Rules that are genuinely form-level, with no single field to attach to
(e.g. a duplicate check that only resolves after hitting the database, or a
uniqueness constraint the schema itself can't express) return a form-level
message instead — surfaced via the `Alert` per §1, not a field.

### What Zod is not used for

- **Authorization** (does this user own this resource?) — that's
  `docs/auth.md`'s job (`verifySession()` + query-level `userId` scoping),
  not a schema concern. A schema validates *shape*, not *ownership*.
- **Sanitizing for display** — Zod validates that input conforms to the
  expected shape; it is not an XSS/HTML-sanitization layer. React's default
  escaping already handles safe rendering; nothing in this app uses
  `dangerouslySetInnerHTML` with user input.

## 3. Mapping internal errors to user-facing messages

Every place an exception can occur — a Server Action, a Route Handler, a
Server Component's data fetch — catches it, logs the real error server-side,
and returns/renders one of a small, deliberate set of generic messages.
Never the caught error's own `.message` (that string can contain a
Mongoose validation string, a MongoDB driver error, or, worse, leak schema
details useful to an attacker probing the app).

```ts
// app/actions/expenses.ts
export async function deleteExpense(expenseId: string) {
  const { userId } = await verifySession();
  try {
    const result = await Expense.deleteOne({ _id: expenseId, userId });
    if (result.deletedCount === 0) {
      return { error: "Expense not found." };
    }
    return { success: true };
  } catch (err) {
    console.error("deleteExpense failed", err); // full detail, server-side only
    return { error: "Something went wrong deleting this expense. Please try again." };
  }
}
```

Recommended generic messages, reused rather than invented per call site:

| Situation | Message |
|---|---|
| Unexpected server/database failure | "Something went wrong. Please try again." |
| Resource not found / not owned by the requester | "We couldn't find that. It may have been removed." (see `docs/auth.md` §5 — "not found" and "not yours" are always indistinguishable) |
| Auth failure | "Invalid email or password." (see `docs/auth.md` §6 — never reveals which part was wrong) |
| Network/timeout on the client | "Couldn't connect. Check your connection and try again." |
| Rate-limited / too many attempts | "Too many attempts. Please wait a moment and try again." |

### Route-level crashes: `error.tsx`

For an exception that escapes a Server Component entirely (not caught by
the component itself), the nearest `error.tsx` (per `docs/routing.md` §7)
renders the same generic pattern — a centered `Alert` plus a "Try again"
`Button` wired to the `reset()` function Next.js passes to `error.tsx` — and
logs `error` (which Next.js gives `error.tsx` directly) via
`console.error`/a real logger before rendering anything:

```tsx
// app/(app)/expenses/error.tsx
"use client";

import { useEffect } from "react";
import { Alert, Button } from "@heroui/react";

export default function ExpensesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Alert color="danger" title="Something went wrong">
      <p>We couldn&apos;t load your expenses. Please try again.</p>
      <Button color="danger" variant="flat" onPress={reset}>
        Try again
      </Button>
    </Alert>
  );
}
```

`error.tsx` is a Client Component (Next.js requirement for error
boundaries) — it never renders `error.message` or `error.stack` directly.
`error.digest`, which Next.js attaches for errors that occur during
server rendering, may be logged/displayed as a reference code for support
purposes since it's an opaque identifier, not the error content itself.

### Production error overlays

Next.js's default dev-mode error overlay (showing component stacks, source
snippets) only ever appears in development. No configuration is needed to
suppress it in production — Next.js does this itself — but this is called
out so it's never "fixed" by suppressing errors more broadly (e.g.
swallowing exceptions) instead of relying on the framework's existing
dev/prod split plus this doc's `error.tsx`/`Alert` pattern for the
production experience.

## 4. Accessibility of error content

- Every `Alert` used for an error keeps HeroUI's default `role="alert"`
  behavior so assistive tech announces it immediately — this is what
  `docs/ui.md` §5.1 already specifies for the login failure case, and
  applies uniformly everywhere per this doc, consistent with `docs/ui.md`
  §7's accessibility checklist.
- An `Alert`'s message is never conveyed by color alone — the `danger`
  color always ships with HeroUI's default icon and explicit text (per
  `docs/ui.md` §7).
- Focus moves to the `Alert` (or the field it's attached to) when it first
  appears as a result of a user action (form submit), so keyboard/screen
  reader users aren't left on a control with no indication anything
  happened.

## 5. Non-goals

- No custom error-boundary UI outside HeroUI's `Alert` — no bespoke banner
  component, no third-party toast/error library.
- No client-side-only validation as the actual guarantee — every Zod
  schema used for client feedback is also enforced server-side in the
  Server Action/Route Handler that receives the data.
- No silent failure — every catch block either recovers meaningfully or
  surfaces a generic `Alert`; nothing is caught and discarded.
- No leaking of internal identifiers, query shapes, or library-specific
  error strings (Mongoose `ValidationError` text, MongoDB duplicate-key
  messages) into any user-facing string.
