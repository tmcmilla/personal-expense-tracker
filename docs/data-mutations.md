# Data Mutations — Personal Expense Tracker

This document specifies how data changes (create/update/delete on `Expense`,
`ExpenseCategory`, `MonthlySummary`, and any resource added later) are
implemented. It complements `docs/routing.md` (Server Actions vs. Route
Handlers), `docs/errors-and-validation.md` (Zod schemas, error mapping), and
`docs/auth.md` (per-request/per-user authorization) — this doc is specifically
about the mutation call shape: where it lives, what it's called with, and how
it's typed.

## 1. Principles

- **Server Actions are the only mutation surface.** Every create/update/delete
  triggered by this app's own UI is a Server Action in `app/actions/`. There is
  no client-side mutation logic (no `fetch`/`axios` call from a Client
  Component hitting a REST endpoint this app owns) and no additional Route
  Handler standing in for one — `docs/routing.md` §9 already reserves Route
  Handlers for things with a genuine external HTTP contract (NextAuth's own
  endpoint, a future webhook), never for in-app CRUD.
- **No generic `FormData` in new mutation code.** A Server Action's parameter
  is the same strongly-typed, Zod-inferred shape used everywhere else that
  resource is validated — never `FormData`, and never
  `formData.get("field")` parsing inside the action body. `FormData` is a bag
  of untyped strings/`File`s; typing the parameter directly gets compiler
  errors on a renamed/removed field instead of a silent runtime miss.
- **Validated at the boundary regardless of the declared type.** A Server
  Action is a public network endpoint — Next.js compiles it to a callable
  HTTP handler no matter how it's typed at the call site. Typing the
  parameter as e.g. `ExpenseInput` is for editor/compile-time safety within
  this codebase; it is not a substitute for `schema.safeParse()` inside the
  action, which runs unconditionally.
- **Authorization is never optional.** Every mutation Server Action calls
  `verifySession()` (`app/lib/dal.ts`) first and scopes every write by the
  returned `userId`, per `docs/auth.md` §4–§5. This doc doesn't repeat those
  rules — it assumes them.

## 2. Where mutations live

Same layout as `docs/routing.md` §3/§8: one file per resource in
`app/actions/`, colocated Zod schemas in `app/lib/validation/`.

```
app/actions/
  expenses.ts     # createExpense, updateExpense, deleteExpense
  categories.ts   # createCategory, deleteCategory
  auth.ts         # signup — see §6, this one predates this doc

app/lib/validation/
  expense.ts      # expenseSchema, expenseUpdateSchema
  category.ts     # categorySchema
```

## 3. Server Action signature

```ts
// app/actions/expenses.ts
"use server";

import { verifySession } from "@/app/lib/dal";
import { expenseSchema, type ExpenseInput } from "@/app/lib/validation/expense";
import { Expense } from "@/models/Expense";

export type MutationResult = {
  fieldErrors?: Record<string, string[]>;
  error?: string;
  success?: boolean;
};

export async function createExpense(input: ExpenseInput): Promise<MutationResult> {
  const { userId } = await verifySession();

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await Expense.create({ userId, ...parsed.data });
    return { success: true };
  } catch (err) {
    console.error("createExpense failed", err);
    return { error: "Something went wrong. Please try again." };
  }
}
```

- The parameter is `ExpenseInput` (`z.infer<typeof expenseSchema>`), not
  `unknown` and not `FormData`.
- `safeParse` — never bare `parse()` — matching
  `docs/errors-and-validation.md` §2.
- The return shape (`fieldErrors` / `error` / `success`) is the same small
  contract used across every mutation, so a Client Component's error-mapping
  code doesn't have to special-case each resource.

## 4. Calling a Server Action from a Client Component

Build the typed payload from component state, then call the action directly
as an async function — do **not** wire it to a `<form>`'s `action` prop,
since a native form submission hands the action a `FormData` object, not the
typed payload.

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@heroui/react";
import { createExpense, type MutationResult } from "@/app/actions/expenses";

export function AddExpenseForm({ onSaved }: { onSaved: () => void }) {
  const [amount, setAmount] = useState<number>(0);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<MutationResult>();
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const res = await createExpense({
        amount,
        categoryId,
        date: new Date(),
        description,
      });
      setResult(res);
      if (res.success) onSaved();
    });
  }

  return (
    <>
      <Input
        type="number"
        label="Amount"
        value={String(amount)}
        onValueChange={(v) => setAmount(Number(v))}
        isInvalid={!!result?.fieldErrors?.amount}
        errorMessage={result?.fieldErrors?.amount?.[0]}
      />
      {/* Category select, description Textarea, etc. */}
      <Button color="primary" isLoading={isPending} onPress={handleSave}>
        Save
      </Button>
    </>
  );
}
```

- Controlled inputs (`useState` per field) build the typed object — the
  component never touches `FormData`.
- `useTransition` provides `isPending` per `docs/best-practices.md` §6.11,
  instead of a hand-rolled `isLoading` boolean.
- Field/form errors are mapped exactly per `docs/errors-and-validation.md`
  §1–§2: field-level onto `isInvalid`/`errorMessage`, form-level (`result.error`)
  onto an `Alert`, never the raw caught exception.

## 5. No client-side mutation logic

- Nothing in a Client Component calls `fetch`/`axios` against a Route Handler
  this app owns to create/update/delete a resource — that's exactly the
  second, unnecessary surface `docs/routing.md` §9 already warns against.
- Don't fake a mutation with client-only state (e.g. pushing an item into a
  local array and never calling the Server Action) — every visible change is
  backed by a real Server Action round trip that persists it.
- Instant-feeling UI is achieved with React's `useOptimistic` layered **on
  top of** a real Server Action call, not as a replacement for one — the
  optimistic value is reconciled once the action's result comes back.

## 6. Revalidation

A mutation that changes data a Server Component already rendered calls
`revalidatePath()` (or `revalidateTag()` if a resource is tagged) scoped to
the affected route — e.g. `revalidatePath("/expenses")` after
`createExpense`, not a blanket `revalidatePath("/")` that invalidates
unrelated pages. `redirect()` is only used when the mutation should also
navigate the user somewhere (e.g. back to a list after a delete inside a
detail view) — not as a substitute for revalidation.

## 7. Existing exception: `signup`

`app/actions/auth.ts`'s `signup` action (`docs/auth.md` §6) predates this
doc and is intentionally wired through `<form action={signupAction}>` +
`useActionState` + `FormData`, matching NextAuth's usual progressive-
enhancement convention for auth forms specifically. It is not amended by
this doc and is not a template for new resource mutations — `login` and
`signup` are the one deliberate carve-out; every other mutation (expenses,
categories, settings, and anything added later) follows §3–§4 above.

## 8. Non-goals

- No Route Handlers for CRUD the in-app UI performs (still just NextAuth's
  own endpoint, and, if ever needed, a webhook or public/external API — see
  `docs/routing.md` §9).
- No client-side data-fetching/mutation library (react-query mutations,
  SWR mutate against a REST endpoint) standing in for a Server Action.
- No raw `formData.get(...)` parsing in new mutation code — see §7 for the
  one existing exception and why it doesn't extend to new work.
- No bare `.parse()` inside a Server Action — always `.safeParse()`, per
  `docs/errors-and-validation.md` §2.
