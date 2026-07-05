"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@heroui/react";
import type { SpendOverTimePointDTO } from "@/app/lib/data/dashboard";

const SpendOverTimeChart = dynamic(
  () =>
    import("@/app/lib/charts/SpendOverTimeChart").then((m) => m.SpendOverTimeChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full rounded-lg sm:h-72 lg:h-80" />,
  },
);

export default function SpendOverTimeChartLoader({
  points,
}: {
  points: SpendOverTimePointDTO[];
}) {
  return <SpendOverTimeChart points={points} />;
}
