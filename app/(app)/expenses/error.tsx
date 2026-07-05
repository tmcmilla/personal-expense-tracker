"use client";

import { useEffect } from "react";
import { Alert, Button } from "@heroui/react";

export default function ExpensesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <Alert color="danger" title="Something went wrong">
        <p>We couldn&apos;t load your expenses. Please try again.</p>
        <Button
          color="danger"
          variant="flat"
          onPress={reset}
          className="mt-3"
        >
          Try again
        </Button>
      </Alert>
    </div>
  );
}
