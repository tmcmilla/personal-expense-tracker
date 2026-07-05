"use client";

import { useState, useTransition } from "react";
import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  addToast,
} from "@heroui/react";
import { deleteExpense } from "@/app/actions/expenses";
import type { ExpenseDTO } from "@/app/lib/data/expenses";

type DeleteExpenseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  expense: ExpenseDTO | null;
  onDeleted: () => void;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

// The parent remounts this component (via a `key` that changes on every
// open) so `error` always starts fresh — see ExpensesClient.
export default function DeleteExpenseModal({
  isOpen,
  onClose,
  expense,
  onDeleted,
}: DeleteExpenseModalProps) {
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!expense) return;

    startTransition(async () => {
      const res = await deleteExpense(expense.id);
      if (res.success) {
        addToast({ title: "Expense deleted", color: "success" });
        onDeleted();
      } else {
        setError(res.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      placement="center"
    >
      <ModalContent>
        <ModalHeader>Delete this expense?</ModalHeader>
        <ModalBody className="gap-3">
          {error && <Alert color="danger">{error}</Alert>}
          {expense && (
            <p className="text-default-600">
              {expense.description || "This expense"} —{" "}
              {currencyFormatter.format(expense.amount)} on{" "}
              {dateFormatter.format(new Date(expense.date))}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="danger" isLoading={isPending} onPress={handleDelete}>
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
