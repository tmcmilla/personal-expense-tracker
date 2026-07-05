import { Card, CardBody, CardHeader, Progress } from "@heroui/react";
import { categoryColor } from "./categoryColor";
import type { DashboardSummaryDTO } from "@/app/lib/data/dashboard";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function CategoryBreakdown({
  summary,
}: {
  summary: DashboardSummaryDTO;
}) {
  return (
    <Card>
      <CardHeader className="text-lg font-semibold">Category breakdown</CardHeader>
      <CardBody className="gap-4">
        {summary.byCategory.map((entry) => (
          <div key={entry.categoryId} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span>{entry.categoryName}</span>
              <span className="text-default-500">
                {currencyFormatter.format(entry.total)}
              </span>
            </div>
            <Progress
              aria-label={`${entry.categoryName} spending`}
              value={
                summary.totalAmount > 0
                  ? (entry.total / summary.totalAmount) * 100
                  : 0
              }
              color={categoryColor(entry.categoryId)}
            />
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
