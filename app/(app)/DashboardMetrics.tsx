import { Card, CardBody } from "@heroui/react";
import type { DashboardSummaryDTO } from "@/app/lib/data/dashboard";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function DashboardMetrics({
  summary,
}: {
  summary: DashboardSummaryDTO;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardBody className="gap-1">
          <p className="text-default-500 text-sm">Total spent</p>
          <p className="text-2xl font-semibold">
            {currencyFormatter.format(summary.totalAmount)}
          </p>
        </CardBody>
      </Card>
      <Card>
        <CardBody className="gap-1">
          <p className="text-default-500 text-sm">Transactions</p>
          <p className="text-2xl font-semibold">{summary.transactionCount}</p>
        </CardBody>
      </Card>
      <Card>
        <CardBody className="gap-1">
          <p className="text-default-500 text-sm">Average per transaction</p>
          <p className="text-2xl font-semibold">
            {currencyFormatter.format(summary.averagePerTransaction)}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
