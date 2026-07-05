"use client";

import { useMemo } from "react";
import "@/app/lib/charts/register";
import { Line } from "react-chartjs-2";
import type { TooltipItem } from "chart.js";
import { useChartTheme } from "@/app/lib/charts/useChartTheme";
import { ChartContainer } from "@/app/lib/charts/ChartContainer";
import type { SpendOverTimePointDTO } from "@/app/lib/data/dashboard";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function SpendOverTimeChart({ points }: { points: SpendOverTimePointDTO[] }) {
  const theme = useChartTheme();

  const data = useMemo(
    () => ({
      labels: points.map((point) => point.label),
      datasets: [
        {
          label: "Total spent",
          data: points.map((point) => point.total),
          borderColor: theme.primary,
          backgroundColor: theme.primaryTransparent,
          fill: true,
          tension: 0.3,
        },
      ],
    }),
    [points, theme],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: theme.prefersReducedMotion ? (false as const) : undefined,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: "index" as const,
          intersect: false,
          callbacks: {
            label: (context: TooltipItem<"line">) =>
              currencyFormatter.format(context.parsed.y ?? 0),
          },
        },
      },
      scales: {
        x: { grid: { color: theme.gridLine }, ticks: { color: theme.mutedText } },
        y: { grid: { color: theme.gridLine }, ticks: { color: theme.mutedText } },
      },
    }),
    [theme],
  );

  return (
    <ChartContainer aria-label={`Spending over time, last ${points.length} months`}>
      <Line data={data} options={options} />
    </ChartContainer>
  );
}
