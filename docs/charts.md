# Charts — react-chartjs-2

> This doc is the named charts exception to `docs/ui.md`'s HeroUI-only
> policy — see `docs/ui.md` §1 and §6. It covers every screen that needs a
> chart HeroUI's own primitives can't express (multi-series trends,
> time-series spend-over-time views), not cases HeroUI's
> `Progress`/`CircularProgress` already cover (single-value proportional
> breakdowns, e.g. the existing dashboard category breakdown), which stay
> as they are.

This document specifies how charts are built: library choice, theming,
responsiveness, performance, and accessibility.

## 1. Library and scope

- **`react-chartjs-2`** (thin React wrapper) **+ `chart.js`** (rendering
  engine) are the only charting libraries used. Do not add a second charting
  library for a use case Chart.js already covers.
- Chart.js ships several chart controllers; this app only registers the ones
  actually used, via Chart.js's tree-shakeable registration model — never
  `import "chart.js/auto"`, which pulls in every controller/element/plugin
  regardless of use:

  ```ts
  // app/lib/charts/register.ts
  import {
    Chart,
    CategoryScale,
    LinearScale,
    TimeScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Filler,
  } from "chart.js";

  Chart.register(
    CategoryScale,
    LinearScale,
    TimeScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Filler,
  );
  ```

  Import this module once, at the top of each chart wrapper component (§3) —
  not in the root layout — so a route that never renders a chart doesn't pay
  for Chart.js in its bundle.
- Chart type per use case: `Line` for spend-over-time, `Bar` for
  period-over-period comparisons (e.g. this month vs. last month per
  category), `Doughnut` only where a HeroUI `Progress`/`CircularProgress`
  genuinely cannot express the layout (e.g. an at-a-glance multi-category
  ring shown alongside, not instead of, the `Progress` breakdown list). Don't
  introduce a chart type not already covered by an approved plan.

## 2. Component boundary and data flow

- Charts are always **Client Components** (`"use client"`) — Chart.js
  renders to `<canvas>`, which requires the DOM. The Server Component page
  fetches data via the resource's Data Access Layer (`docs/data-fetching.md`)
  and passes a plain, already-shaped DTO down as props; the chart component
  does no fetching itself.
- Pass only the fields the chart actually renders (labels + series values),
  not the full DTO — same rule as `docs/best-practices.md` §3.6. A page that
  needs both a table and a chart from the same query shapes two narrow
  props from the one DAL call, rather than handing the whole document to
  both.
- Each chart's data-shaping (grouping, sorting, percentage math) happens
  server-side in the DAL/Server Component, not inside the chart component —
  the chart component's only job is presentation. This keeps the same
  aggregation logic (e.g. `getDashboardSummary` in
  `app/lib/data/dashboard.ts`) as the single source of truth whether it
  feeds a `Progress` bar or a chart.

## 3. Structure: wrapper components

Every chart is a small dedicated wrapper component under
`app/lib/charts/`, one file per chart "kind" (e.g. `SpendOverTimeChart.tsx`,
`CategoryComparisonChart.tsx`) — never a raw `<Line>`/`<Bar>` inlined
directly into a page or feature component. The wrapper owns:

1. Chart.js registration import (§1).
2. Mapping the narrow DTO prop into Chart.js's `data`/`options` shape.
3. Theme color resolution (§4).
4. The responsive/sizing container (§5).
5. Accessibility fallbacks (§7).

```tsx
// app/lib/charts/SpendOverTimeChart.tsx
"use client";

import "@/app/lib/charts/register";
import { Line } from "react-chartjs-2";
import { useChartTheme } from "@/app/lib/charts/useChartTheme";
import { ChartContainer } from "@/app/lib/charts/ChartContainer";

type SpendOverTimePoint = { date: string; total: number };

export function SpendOverTimeChart({ points }: { points: SpendOverTimePoint[] }) {
  const theme = useChartTheme();

  return (
    <ChartContainer aria-label="Spending over time" data={points}>
      <Line
        data={{
          labels: points.map((p) => p.date),
          datasets: [
            {
              label: "Total spent",
              data: points.map((p) => p.total),
              borderColor: theme.primary,
              backgroundColor: theme.primaryTransparent,
              fill: true,
              tension: 0.3,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: theme.prefersReducedMotion ? false : undefined,
          plugins: {
            legend: { display: false },
            tooltip: { mode: "index", intersect: false },
          },
          scales: {
            x: { grid: { color: theme.gridLine }, ticks: { color: theme.mutedText } },
            y: { grid: { color: theme.gridLine }, ticks: { color: theme.mutedText } },
          },
        }}
      />
    </ChartContainer>
  );
}
```

## 4. Theming — matching HeroUI's light/dark design system

Chart.js takes plain CSS color strings; it can't consume Tailwind classes,
so chart colors are read from the same HeroUI CSS variables that drive every
other component, not hardcoded hex values.

- HeroUI (via `hero.ts`'s `heroui()` plugin) defines each semantic color as
  an HSL-components custom property on `:root`/`.dark` — e.g.
  `--heroui-primary`, `--heroui-success`, `--heroui-warning`,
  `--heroui-danger`, `--heroui-default`, `--heroui-secondary` — consumed
  elsewhere as `hsl(var(--heroui-primary))`. Charts use the exact same
  variables, so a chart's palette is always the current theme's palette,
  automatically, with no separate "chart palette" to keep in sync.
- `app/lib/charts/useChartTheme.ts` is the single place that resolves these
  variables to concrete color strings for Chart.js:

  ```ts
  // app/lib/charts/useChartTheme.ts
  "use client";

  import { useEffect, useState } from "react";

  type ChartTheme = {
    primary: string;
    primaryTransparent: string;
    success: string;
    warning: string;
    danger: string;
    secondary: string;
    default: string;
    mutedText: string;
    gridLine: string;
    prefersReducedMotion: boolean;
  };

  function readVar(name: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function resolveTheme(): ChartTheme {
    const hsl = (name: string) => `hsl(${readVar(name)})`;
    return {
      primary: hsl("--heroui-primary"),
      primaryTransparent: `hsl(${readVar("--heroui-primary")} / 0.15)`,
      success: hsl("--heroui-success"),
      warning: hsl("--heroui-warning"),
      danger: hsl("--heroui-danger"),
      secondary: hsl("--heroui-secondary"),
      default: hsl("--heroui-default"),
      mutedText: `hsl(${readVar("--heroui-default-500")})`,
      gridLine: `hsl(${readVar("--heroui-default-200")} / 0.5)`,
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  }

  // Re-resolves whenever the `dark`/`data-theme` class HeroUI's theme
  // Switch (docs/ui.md §5.6) toggles on <html> changes, so charts already
  // on screen re-theme instantly instead of only on next mount/refetch.
  export function useChartTheme(): ChartTheme {
    const [theme, setTheme] = useState<ChartTheme | null>(null);

    useEffect(() => {
      setTheme(resolveTheme());
      const observer = new MutationObserver(() => setTheme(resolveTheme()));
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
      return () => observer.disconnect();
    }, []);

    return theme ?? resolveTheme();
  }
  ```

- **Per-category colors** reuse the existing deterministic mapping in
  `app/(app)/categoryColor.ts` (`categoryColor(categoryId)` → a HeroUI
  semantic color name) rather than inventing a separate chart-only palette.
  A chart that colors series by category resolves each category's semantic
  name to its `useChartTheme()` value, so a category's `Chip` color and its
  chart series color are always the same color:

  ```ts
  const seriesColor = theme[categoryColor(entry.categoryId)];
  ```

- Never hardcode a hex/RGB color in a chart's `options`/`data` — every color
  value traces back to `useChartTheme()` (or, for category series,
  `categoryColor()` + `useChartTheme()`). This is what keeps charts visually
  consistent with the rest of the app and correct in both themes without
  chart-specific dark-mode branches.
- Fonts: set Chart.js's global `Chart.defaults.font.family` to the same
  `--font-sans` (Geist) the rest of the app uses, so chart labels/tooltips
  don't default to Chart.js's built-in Helvetica fallback.

## 5. Responsiveness

- Every chart sets `responsive: true` and `maintainAspectRatio: false` in
  `options`. `maintainAspectRatio: false` is required — Chart.js's default
  aspect-ratio behavior fights CSS-driven heights and produces oversized
  charts inside a HeroUI `Card` on narrow viewports.
- Sizing is entirely CSS-driven through a shared wrapper, `ChartContainer`,
  never an explicit pixel `width`/`height` prop on the `<canvas>`:

  ```tsx
  // app/lib/charts/ChartContainer.tsx
  export function ChartContainer({
    children,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    "aria-label": string;
  }) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        className="relative h-64 w-full sm:h-72 lg:h-80"
      >
        {children}
      </div>
    );
  }
  ```

  A fixed height per breakpoint (via Tailwind, matching `docs/ui.md` §3's
  breakpoints) with `w-full` lets Chart.js's internal `ResizeObserver` (built
  into `react-chartjs-2`) resize the canvas on container/viewport changes
  without a manual resize handler.
- Chart wrappers always live inside a HeroUI `Card`/`CardBody` (per
  `docs/ui.md`'s layout system) using the same responsive grid utilities as
  the rest of the dashboard (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`,
  etc.) — a chart is a `Card` occupant, not a page-level layout primitive.
- On the narrowest breakpoint (`< 640px`, per `docs/ui.md` §3), reduce
  chart-specific chrome rather than shrinking a cluttered chart further:
  hide the legend (`plugins.legend.display: false`) if categories are
  already labeled elsewhere (e.g. a `Chip` legend built from HeroUI
  components alongside the chart), and cap X-axis tick count
  (`ticks: { maxTicksLimit: 4 }`) so date labels don't overlap.
- Never use `next/image` or a raster export for a chart — Chart.js's
  `<canvas>` output is already resolution-independent at render time; a
  static export is only relevant for a future "download chart as PNG"
  feature (out of scope until requested), via `chart.toBase64Image()`, not
  a screenshot library.

## 6. Performance

Chart.js + `react-chartjs-2` is a meaningfully sized dependency; treat it the
same as any other heavy client bundle per `docs/best-practices.md` §2.

- **Always load chart wrapper components with `next/dynamic`, `ssr: false`**
  from the Server Component page — a chart has no meaningful server-rendered
  output (it needs `<canvas>` + a browser), so shipping it in the initial
  server-rendered HTML/JS is wasted work per
  `docs/best-practices.md` §2.4:

  ```tsx
  // app/(app)/page.tsx
  import dynamic from "next/dynamic";

  const SpendOverTimeChart = dynamic(
    () => import("@/app/lib/charts/SpendOverTimeChart").then((m) => m.SpendOverTimeChart),
    { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-lg sm:h-72 lg:h-80" /> },
  );
  ```

  The `loading` fallback matches `ChartContainer`'s own height classes so
  there's no layout shift when the real chart mounts (consistent with the
  `Skeleton`-matches-shape rule in `docs/ui.md` §4).
- Register Chart.js controllers per chart-kind module (§1), not globally in
  `next.config.ts` or the root layout — a route with no charts should
  register nothing.
- Add `chart.js` and `react-chartjs-2` to `optimizePackageImports` in
  `next.config.ts` if they aren't already covered by Next's default list
  (`docs/best-practices.md` §2.1) — verify against the installed Next
  version's default list before assuming it's needed.
- Memoize the `data`/`options` objects passed to `<Line>`/`<Bar>`/`<Doughnut>`
  with `useMemo`, keyed on the actual narrow props (the DTO array, the
  resolved theme) — `react-chartjs-2` re-diffs and can re-animate the chart
  on every parent re-render if handed a fresh object identity each time,
  per the memoization principles in `docs/best-practices.md` §5.
- Cap dataset size sensibly (e.g. a "spend over time" chart buckets by
  day/week/month depending on the selected period, rather than plotting
  every raw `Expense` row) — this is a data-shaping concern that belongs in
  the DAL (§2), not a Chart.js decimation plugin.
- Destroy-on-unmount is handled automatically by `react-chartjs-2` (it tears
  down the underlying `Chart` instance in its own cleanup) — don't add a
  manual `chart.destroy()` call, and don't hold a `Chart` instance in a ref
  across renders.

## 7. Accessibility

Chart.js renders to `<canvas>`, which is opaque to screen readers by
default, so every chart pairs its canvas with a non-visual equivalent —
this is the charting-specific instance of `docs/ui.md` §7's "color is never
the only signal" rule.

- `ChartContainer` (§5) sets `role="img"` and a descriptive `aria-label`
  summarizing the chart's content (e.g. `"Spending over time, June 2026"`),
  not a generic label like `"chart"`.
- For any chart conveying data a user might need in detail (not just at a
  glance), pair it with an existing accessible alternative already on the
  page rather than inventing a chart-specific one — e.g. the "spend over
  time" chart sits alongside, not instead of, the `Expenses` `Table`/
  `Listbox` (`docs/ui.md` §5.3) that has the same data in accessible tabular
  form.
- Series are never distinguished by color alone: pair each series/category
  with a text label in the legend or an adjacent HeroUI `Chip` (matching
  `categoryColor()`, per §4), consistent with `docs/ui.md` §7.
- Respect `prefers-reduced-motion` (`docs/best-practices.md` §6 /
  `docs/ui.md` §7): `useChartTheme()` exposes `prefersReducedMotion`;
  pass `animation: false` when it's `true`, as shown in §3's example,
  instead of Chart.js's default entrance/transition animation.
- Tooltips must be reachable by more than hover: Chart.js tooltips are
  triggered on canvas pointer events without native keyboard support today —
  don't rely on a tooltip alone to convey a data point's exact value that
  isn't available anywhere else; surface exact values in an accessible
  table/list alongside the chart, per the "pair with an existing accessible
  alternative" rule above.

## 8. Testing

- Unit-test the **data-shaping** functions in the DAL (bucketing,
  percentage math) with Vitest, the same as any other DAL function
  (`docs/data-fetching.md`) — this is where correctness bugs actually live.
- Don't unit-test Chart.js's own rendering (canvas output) — it's a
  third-party rendering engine, not app logic. If a chart wrapper's prop
  mapping (DTO → Chart.js `data` shape) is non-trivial, test that mapping
  function in isolation rather than rendering the chart component itself.

## 9. Non-goals

- No second charting library — if a use case doesn't fit `Line`/`Bar`/
  `Doughnut`, that's a signal to revisit this doc, not to add another
  dependency.
- No chart-specific color palette separate from HeroUI's theme — every
  chart color resolves from `--heroui-*` variables (§4).
- No custom canvas-resize logic — `react-chartjs-2`'s built-in
  `ResizeObserver` handling plus CSS sizing (§5) is sufficient.
- No raster/export tooling until a specific export feature is planned and
  approved.
