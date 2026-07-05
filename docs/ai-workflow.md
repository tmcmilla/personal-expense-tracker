# AI-Assisted Development Workflow

This document governs how AI assistance (Claude Code or any equivalent tool)
is used to write code in this project. It exists so that architecture and
implementation decisions are made deliberately and visibly, not embedded
silently inside a diff. It complements the other `/docs` files (`ui.md`,
`auth.md`, etc.), which describe *what* to build; this doc describes the
*process* by which any of it gets built.

## 1. Core rule

**No code is written, edited, or generated until the user has explicitly
approved a plan for that specific change.** Planning and implementation are
two distinct phases with a hard stop between them.

## 2. When a plan is required

A plan is required before:

- Any new feature or route.
- Any non-trivial bug fix (i.e. the fix isn't a single obvious line).
- Any refactor touching more than one file.
- Any schema change (`models/*`) or change to how data is stored or queried.
- Any dependency added, removed, or upgraded.
- Any architecture or infrastructure decision (auth, routing, state
  management, third-party services).

A plan is **not** required for:

- Read-only work: answering questions, exploring the codebase, explaining
  code, reviewing a diff.
- Genuinely trivial, unambiguous edits explicitly spelled out by the user
  (e.g. "rename this variable to X," "fix this typo") where there is only one
  reasonable way to do it.
- Editing files under `/docs` themselves, when the doc *is* the deliverable
  being requested (as with this file).

If it's unclear whether something counts as trivial, treat it as requiring a
plan — the cost of a short unnecessary plan is much lower than the cost of
unreviewed code.

## 3. What the plan must contain

Every plan presented to the user includes:

1. **Problem / goal** — what is being built and why, restated in concrete
   terms so the user can confirm the request was understood correctly.
2. **Architecture** — how this fits into the existing system: which parts of
   `app/`, `models/`, `lib/` are involved, new files/modules to be created,
   how data flows through them, and how it aligns with any relevant doc
   already in `/docs` (e.g. a new screen should be described in terms of
   `docs/ui.md`'s components; anything touching login/session/data-ownership
   should be checked against `docs/auth.md`).
3. **Implementation steps** — an ordered, concrete list of the changes to be
   made (files to add/edit, functions to introduce, migrations to run).
4. **Assumptions and open questions** — anything genuinely ambiguous is
   surfaced as a question to the user, not silently resolved by guessing.
5. **Explicitly out of scope** — what this plan does *not* cover, so the
   boundary of the approved work is unambiguous.

The plan is written to be read and judged by the user before any code exists
— it should be possible to reject or redirect it with zero code thrown away.

## 4. Process

1. **Understand first.** Read the relevant existing code and any applicable
   `/docs` file before drafting anything (per the docs-first rule in
   `CLAUDE.md`).
2. **Draft the plan** per §3.
3. **Present the plan and stop.** No source file is created or modified at
   this stage.
4. **Wait for explicit approval.** Moving on to another topic, a vague
   acknowledgment, or silence is not approval. Approval means the user
   affirmatively signs off on the specific plan shown — e.g. "yes," "approved,"
   "go ahead," "looks good, implement it."
5. **If changes are requested,** revise the plan and present it again. Do not
   begin implementing part of it while the scope is still being negotiated.
6. **Only after explicit approval**, implement exactly what was approved.
7. **If implementation must deviate materially** from the approved plan
   (a new file needs touching, a different library is required, a schema
   change wasn't previously mentioned), stop and get approval for that delta
   before continuing — mid-flight scope changes get the same treatment as new
   plans.

## 5. Mechanics

- Use Plan Mode for any task that requires a plan under §2, so the plan is
  presented for explicit approval before any code-writing tool is used.
- Code-writing tools (creating or editing files) are not invoked until that
  approval is given.
- Read-only exploration (reading files, searching the codebase, running
  read-only commands) is unrestricted at any stage — building an accurate
  plan requires it.

## 6. What counts as "writing code"

Requires prior approval:

- Creating or editing any file under `app/`, `lib/`, `models/`, `types/`, or
  any other source file.
- Editing configuration with functional effect: `next.config.ts`,
  `eslint.config.mjs`, `package.json` dependencies, environment files.
- Database migrations or seed scripts.

Does not require prior approval:

- Reading files or running read-only commands.
- The plan-drafting process itself.
- Edits to `/docs` when documentation is the explicit deliverable being
  requested (as opposed to `/docs` being updated as a side effect of a code
  change — that update is part of the plan for the code change).

## 7. Scope of approval

- Approval covers the plan as presented — nothing more. Unrelated changes
  noticed along the way are called out to the user, not folded in silently.
- Approval does not carry forward to a new, materially different task. Each
  new feature or change gets its own plan and its own approval.

## 8. Non-goals

- This is not a gate on trivial or read-only actions — it should not slow
  down questions, explanations, or small, explicit, unambiguous requests.
- Exploratory questions ("what do you think about X," "how should we
  approach Y") get a short recommendation with tradeoffs, not a full plan —
  a plan is only drafted once the user decides to proceed.
