import { Card, CardBody, Skeleton } from "@heroui/react";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-10 w-48 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardBody>
              <Skeleton className="h-16 w-full rounded-lg" />
            </CardBody>
          </Card>
        ))}
      </div>
      <Card>
        <CardBody className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full rounded-lg" />
          ))}
        </CardBody>
      </Card>
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
