import { Card, CardBody, Skeleton } from "@heroui/react";

export default function ExpensesLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-14 w-48 rounded-lg" />
        <Skeleton className="h-14 w-64 rounded-lg" />
        <Skeleton className="h-14 w-56 rounded-lg" />
      </div>
      <Card>
        <CardBody className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
