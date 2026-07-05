# UI Design — Personal Expense Tracker

This document specifies the production UI for the app, built **exclusively with HeroUI
components**. No custom-styled elements, no bespoke CSS, no third-party chart/UI
libraries. Tailwind utility classes are only used for the layout primitives HeroUI
itself expects (flex/grid spacing, responsive breakpoints) — never to reskin or
replace a HeroUI component.

Domain context this UI is designed against (see `models/`): a `User` tracks
`Expense` records (amount, category, date, description), grouped under
`ExpenseCategory` (system defaults + user-created). The dashboard's totals
and per-category breakdown are computed live from `Expense` via aggregation,
scoped to the selected month — `models/MonthlySummary.ts` exists but nothing
currently writes to it, so it isn't the dashboard's data source (see
`app/lib/data/dashboard.ts`).

## 1. Principles

- **HeroUI-only.** Every visible element — buttons, inputs, cards, nav, tables,
  charts-adjacent breakdowns, feedback — maps to a documented HeroUI component.
  If a screen seems to need something HeroUI doesn't provide, compose it from
  existing primitives (see §6) rather than hand-rolling a component.
- **Charts are the one named exception.** For data HeroUI's own primitives
  can't express — multi-series or time-series views (e.g. spend over time) —
  use `react-chartjs-2`/Chart.js per `docs/charts.md`, which also specifies
  theming the chart from this doc's HeroUI colors so it still reads as one
  system. This doesn't apply to the existing dashboard category breakdown
  (§5.2), which is a single-value proportional display and stays on HeroUI
  `Progress`.
- **One `HeroUIProvider`, one theme.** All color, radius, and spacing decisions are
  expressed through the HeroUI/Tailwind theme config (`hero.ts` plugin config), not
  inline styles or one-off classes. Light and dark themes both ship at launch.
- **Mobile-first, one layout system.** The same component tree adapts from a single
  phone column up to a desktop shell with persistent nav — no separate "mobile UI."
- **Accessible by default.** HeroUI components are built on React Aria, so
  correct usage (labels, descriptions, focus order) gets accessibility for free.
  This doc calls out the places where that still requires a deliberate choice.

## 2. Foundations

### Theme

- Configure light + dark themes via the HeroUI Tailwind plugin (`heroui()` in
  `tailwind.config`/`postcss` theme extension). Define semantic colors only:
  `primary`, `success`, `warning`, `danger`, `default` — screens reference these
  semantic names, never raw hex values.
- `primary` drives all primary actions (submit, save, confirm) and the active-nav
  indicator. `danger` is reserved for destructive actions (delete expense/category)
  and error `Alert` content. `success` confirms completed actions (expense
  saved, category created) via `Toast`. `warning` flags approaching-budget or validation caveats.
- Border radius: use HeroUI's `lg` radius scale consistently across `Card`,
  `Input`, `Modal`, and `Button` so the whole app reads as one shape language.
- Respect system color-scheme by default; expose an explicit override via a
  `Switch` in the header `Navbar` (`ThemeSwitch`, §3 — desktop right-aligned
  `NavbarContent`, mobile `NavbarMenu`) rather than only relying on OS
  detection. The override is stored in `localStorage`
  (`expense-tracker:theme:v1`) and re-applied before hydration so it never
  flashes the other theme on load.

### Typography

- Use HeroUI's default type scale as-is (no custom font sizes). Page titles use
  the largest scale step available to `Card`/`Navbar` slots; body content and
  table cells use the base step; helper/error text under form fields uses the
  smallest step, always paired with the semantic color (`danger`, `default`).

### Iconography

- HeroUI ships without an icon set; pair it with `lucide-react` (or
  `@heroui/shared-icons` if present in the installed version) rendered strictly
  inside HeroUI's `startContent`/`endContent`/`isIconOnly` slots (`Button`,
  `Input`, `Chip`, `Navbar`). Icons are never placed as free-floating elements
  outside a component slot — that would reintroduce custom layout.

## 3. App shell & navigation

### Desktop (≥ 1024px)

- `Navbar` pinned at the top, `maxWidth="full"`, containing: app name/logo as
  `NavbarBrand`, primary sections as `NavbarItem` links (Dashboard, Expenses,
  Categories), and a right-aligned `NavbarContent` with a `Button` ("Add
  expense", `color="primary"`) and a `Dropdown` (avatar `User` component trigger)
  for account actions (Profile, Settings, Log out).
- No separate sidebar component is introduced — HeroUI has no dedicated sidebar
  primitive, and a `Navbar`-only shell keeps the app to components that exist.
  Section switches happen via the `Navbar` links; page-local sub-navigation (e.g.
  filters within Expenses) uses `Tabs`, scoped to that page's `Card`.

### Mobile (< 1024px)

- `Navbar` collapses to: `NavbarBrand` + `NavbarMenuToggle`. Toggling opens
  `NavbarMenu` with `NavbarMenuItem` entries for the same sections, plus Profile,
  Settings, and Log out at the bottom, separated by a `Divider`.
- The "Add expense" action moves from the `Navbar` into a fixed-position
  `Button` (`isIconOnly`, `radius="full"`, `color="primary"`) placed bottom-right
  via a plain flex/fixed wrapper — the button itself is unmodified HeroUI, only
  its position is layout, not style.
- Tables that don't fit a narrow viewport switch to HeroUI `Table`'s built-in
  responsive behavior is insufficient on its own for very small screens; for the
  Expenses list specifically, below `sm` breakpoint each row is instead rendered
  as a `Listbox`/`ListboxItem` stack (same data, list layout) so no data is
  truncated or hidden — see §5.2.

### Breakpoints

| Range        | Layout                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| `< 640px`    | Single column, `Listbox` row layout for tabular data, bottom-right FAB |
| `640–1024px` | Single column, `Table` becomes usable, `Navbar` still collapsed        |
| `≥ 1024px`   | Full `Navbar`, `Table`, multi-column `Card` grids on Dashboard         |

All breakpoints reuse the same components; only column/stack arrangement changes
via Tailwind's responsive grid utilities wrapping the components.

## 4. Global states

Every data-bearing screen defines all four states below using only HeroUI
components — no screen ships with just the "happy path."

| State   | Component(s)                                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Loading | `Skeleton` matching the shape of the eventual `Card`/`Table` row; `Spinner` only for in-flight actions inside a `Button` (`isLoading`) |
| Empty   | `Card` with centered `CardBody`: short message + primary `Button` ("Add your first expense", "Create a category")                      |
| Error   | `Alert` (`color="danger"`) for every non-field-scoped failure — section load failures and action/mutation failures (failed save/delete) alike. See `docs/errors-and-validation.md` for the full policy. |
| Success | `Toast` (`color="success"`) on create/update/delete confirmation                                                                       |

Toast is reserved for success confirmations only — no error, of any scope,
renders as a Toast, since a transient, auto-dismissing surface is a poor fit
for a message the user needs to act on or investigate.

Form validation errors render via each input's own `isInvalid`/`errorMessage`
props (`Input`, `Select`, `DatePicker`) — never a separate custom error banner
for field-level issues.

## 5. Screens

### 5.1 Authentication — `/login`, `/signup`

- Centered `Card` (`max-w-sm`, single column) on a plain themed background —
  replaces the current hand-styled `AuthCard`/raw `<input>` markup.
- `CardHeader`: app name + page title ("Welcome back" / "Create your account").
- `CardBody`: a `Form` wrapping HeroUI `Input`s —
  - Signup: Name, Email, Password, Confirm password.
  - Login: Email, Password, plus a `Link` styled as HeroUI's `Link` component
    for "Forgot password?".
  - Each `Input` sets `label`, `type`, `autoComplete`, `isRequired`, and
    `isInvalid`/`errorMessage` bound to field-level validation state. Password
    fields use `endContent` with an icon-only `Button` to toggle visibility
    (`type="text"`/`"password"`), with `aria-label="Show password"` /
    `"Hide password"` toggled to match state.
  - Submit `Button` (`color="primary"`, full width, `isLoading` while pending).
- `CardFooter`: `Link` to the other auth page ("Don't have an account? Sign up").
- Auth failures surface as an `Alert` (`color="danger"`) inside `CardBody`,
  above the form fields, with `role="alert"` (HeroUI sets this by default) so
  screen readers announce it immediately on failed submit.

### 5.2 Dashboard — `/`

Default landing page after login. Built from a live aggregation over
`Expense`, scoped to the selected month (see `app/lib/data/dashboard.ts`),
not the precomputed `MonthlySummary` collection.

- Page header: current month/year as text, with a `Select` (or `Tabs` if the
  range is small, e.g. last 6 months) to switch the summary period.
- Top row: three `Card`s in a responsive grid (`grid-cols-1 sm:grid-cols-3`) —
  Total spent this month, Number of transactions, Average per transaction.
  Each card body pairs a label with the value as HeroUI's large text scale step.
- Category breakdown: a `Card` containing, per category, a `Progress` bar
  (`value` = category total ÷ month total, `color` mapped from category, label
  = category name + formatted amount). `Progress`/`CircularProgress` remain
  the pattern for this proportional breakdown specifically — stacking them
  reads as a breakdown without needing a chart. A future dashboard section
  needing a genuinely multi-series or time-series view (e.g. spend over
  time) uses a chart per `docs/charts.md` instead (see §1, §6).
- "Recent expenses": the 5 most recent `Expense` rows reusing the same row
  presentation as §5.3, inside a `Card`, with a `Button` (`variant="light"`)
  linking to the full Expenses page.
- Empty month (no expenses yet): the whole dashboard content area is replaced
  by the empty-state `Card` from §4.

### 5.3 Expenses — `/expenses`

- Header row: page title, a `Button` (`color="primary"`, icon `+`) opening the
  Add Expense `Modal` (§5.4), and filter controls — `Select` for category,
  `DateRangePicker` for the date window, `Input` (`type="search"`) for
  description search. On mobile these collapse into a `Popover` triggered by a
  single "Filters" `Button` to avoid cramming five controls into one row.
- Data display:
  - `≥ 640px`: HeroUI `Table` with columns Date, Category (`Chip`, colored per
    category), Description, Amount (right-aligned), Actions (`Dropdown` with
    Edit/Delete). `Table` uses `isStriped` and built-in `Pagination` below it.
  - `< 640px`: `Listbox` with one `ListboxItem` per expense — top line
    Description + Amount, bottom line Date + category `Chip` — `ListboxItem`'s
    own `endContent` hosts the actions `Dropdown`. Same data, no columns lost.
- Deleting an expense opens a confirmation `Modal` ("Delete this expense?")
  with a `danger` confirm `Button` — no destructive action fires directly off
  a menu item.
- Bulk empty state (no expenses match filters): `Card` explaining that no
  results match, with a `Button` (`variant="light"`) to clear filters.

### 5.4 Add / Edit Expense — Modal, launched from Dashboard or Expenses

- HeroUI `Modal` (`placement="center"` desktop, full-height sheet-style on
  mobile via HeroUI's responsive modal sizing, not custom CSS).
- `ModalHeader`: "Add expense" / "Edit expense".
- `ModalBody`, a `Form` with:
  - `Input` (`type="number"`, `startContent="$"`) for Amount.
  - `Select` for Category, populated from the user's categories +
    system defaults; includes an inline "+ New category" option that opens the
    Create Category `Modal` (§5.5) on top (HeroUI supports stacked modals).
  - `DatePicker` for the expense date, defaulting to today.
  - `Textarea` for Description (optional, `maxLength=500` to match the schema,
    with a character counter using HeroUI's `description` slot).
- `ModalFooter`: `Button` (`variant="light"`) Cancel, `Button`
  (`color="primary"`, `isLoading` while submitting) Save.
- On validation failure, offending fields show `isInvalid` + `errorMessage`
  inline; the modal does not close and focus moves to the first invalid field.

### 5.5 Categories — `/expenses/categories`

- `Table` (or `Listbox` below `sm`, same pattern as §5.3) listing categories:
  Name, Type (`Chip` — "Default" vs "Custom"), Actions.
- System default categories show a disabled Actions `Dropdown` (or omit it
  entirely) — they can't be renamed or deleted, consistent with
  `ExpenseCategory.isDefault`.
- "New category" `Button` opens a small `Modal` with a single `Input` (Name,
  `isRequired`, case-insensitive duplicate check surfaced via `isInvalid` +
  `errorMessage` "You already have a category with this name").
- Deleting a custom category that still has expenses shows a warning `Alert`
  inside the confirmation `Modal` ("12 expenses use this category and will be
  reassigned to Uncategorized") rather than blocking silently.

### 5.6 Settings / Profile — `/settings`

- `Tabs` splitting Profile and Preferences.
- Profile tab: `Card` with `Input`s for Name and Email (Email read-only
  display unless an explicit "Change email" flow is in scope), `Button` to
  save, separate `Card` for password change (current/new/confirm `Input`s).
- Preferences tab: `Select` for currency/date-format display preferences if
  introduced later. The light/dark theme override lives in the header
  `Navbar` (§2), not duplicated here.
- Danger zone: a visually distinct `Card` (`className` limited to spacing
  only) containing a `Button` (`color="danger"`, `variant="flat"`) "Log out"
  and, if account deletion is in scope, "Delete account" behind a confirmation
  `Modal` requiring the user to type their email to confirm.

## 6. Composing beyond HeroUI's primitives

Three patterns above go beyond a single component and are explicitly named
exceptions, not general license for custom UI:

- **Category breakdown (§5.2)** — stacked `Progress` bars. No custom chart.
- **Responsive table→list (§5.3, §5.5)** — the same HeroUI `Table` semantics
  re-expressed as `Listbox` at narrow widths, driven by a Tailwind
  responsive utility toggling which one renders. Both are unmodified HeroUI
  components; only the choice of which one is visible changes per breakpoint.
- **Charts (§1)** — `react-chartjs-2`/Chart.js, per `docs/charts.md`, for
  multi-series/time-series views HeroUI has no primitive for. Themed from
  this doc's HeroUI colors so it doesn't read as a bolted-on library.

If a future requirement can't be met by one of these three exceptions or by
composing existing HeroUI components, that's a signal to revisit this doc
rather than reach for custom CSS.

## 7. Accessibility checklist

- Every `Input`/`Select`/`DatePicker`/`Textarea` has a visible `label` prop —
  never a placeholder used as a label substitute.
- Icon-only `Button`s always set `aria-label`.
- Destructive actions always confirm via `Modal`, never fire directly.
- Color is never the only signal: category `Chip`s carry text (category name),
  `Alert`/`Toast` severity is paired with an icon + text, not color alone.
- Focus management: opening a `Modal` moves focus to its first field; closing
  it (via Cancel, Save, or Esc) returns focus to the triggering `Button`
  (HeroUI's `Modal` does this by default — do not override `autoFocus`
  behavior).
- All interactive components are reachable and operable by keyboard alone
  (HeroUI/React Aria default); manual QA pass required per screen before
  ship — verify `Tab` order matches visual order, especially in the
  filter `Popover` (§5.3) and stacked category-creation `Modal` (§5.4).
- Maintain a minimum 44×44px hit target on mobile for icon-only `Button`s and
  `Dropdown` triggers (use HeroUI's `size="lg"` at narrow breakpoints where the
  default `size` would fall under that).
- Respect `prefers-reduced-motion`; HeroUI's built-in transitions already
  honor this — do not add additional motion on top of component defaults.

## 8. Non-goals

- No custom Tailwind component classes (`.btn`, `.card`, etc.) — only HeroUI
  components and their documented props.
- No third-party table or form libraries. Charts are the sole third-party-
  library exception (§1, §6), scoped exactly to what `docs/charts.md`
  specifies — this doesn't open the door to other non-HeroUI UI libraries.
- No bespoke design tokens outside the HeroUI theme configuration.
- No animation/transition libraries beyond what HeroUI ships with.
