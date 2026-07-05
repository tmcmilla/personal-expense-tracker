import { Card, CardBody, CardHeader } from "@heroui/react";
import type { SpendOverTimePointDTO } from "@/app/lib/data/dashboard";
import SpendOverTimeChartLoader from "./SpendOverTimeChartLoader";

export default function SpendOverTimeCard({
  points,
}: {
  points: SpendOverTimePointDTO[];
}) {
  return (
    <Card>
      <CardHeader className="text-lg font-semibold">Spending over time</CardHeader>
      <CardBody>
        <SpendOverTimeChartLoader points={points} />
      </CardBody>
    </Card>
  );
}
