import type { Metadata } from "next";
import { Card, CardBody } from "@heroui/react";
import {
  getDashboardSummary,
  getRecentExpenses,
  getSpendOverTime,
} from "@/app/lib/data/dashboard";
import { getCategories } from "@/app/lib/data/categories";
import PeriodSelect from "./PeriodSelect";
import DashboardMetrics from "./DashboardMetrics";
import CategoryBreakdown from "./CategoryBreakdown";
import RecentExpenses from "./RecentExpenses";
import SpendOverTimeCard from "./SpendOverTimeCard";
import LinkButton from "./LinkButton";

export const metadata: Metadata = {
  title: "Dashboard | Personal Expense Tracker",
};

function parsePeriod(period: string | undefined): {
  year: number;
  month: number;
} {
  const now = new Date();
  const fallback = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  if (!period) return fallback;

  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return fallback;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return fallback;

  return { year, month };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const periodParam = resolvedSearchParams.period;
  const { year, month } = parsePeriod(
    typeof periodParam === "string" ? periodParam : undefined,
  );

  const [summary, recentExpenses, categories, spendOverTime] = await Promise.all([
    getDashboardSummary(year, month),
    getRecentExpenses(),
    getCategories(),
    getSpendOverTime(),
  ]);

  const isEmptyMonth = summary.transactionCount === 0;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <PeriodSelect year={year} month={month} />
      </div>

      <SpendOverTimeCard points={spendOverTime} />

      {isEmptyMonth ? (
        <Card>
          <CardBody className="items-center gap-4 py-12 text-center">
            <p className="text-default-500">
              No expenses recorded for this month yet.
            </p>
            <LinkButton href="/expenses" color="primary">
              Add your first expense
            </LinkButton>
          </CardBody>
        </Card>
      ) : (
        <>
          <DashboardMetrics summary={summary} />
          <CategoryBreakdown summary={summary} />
          <RecentExpenses expenses={recentExpenses} categories={categories} />
        </>
      )}
    </div>
  );
}
