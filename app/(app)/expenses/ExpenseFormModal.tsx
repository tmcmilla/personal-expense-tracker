"use client";

import { useState, useTransition } from "react";
import {
  Alert,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
  addToast,
  DatePicker,
} from "@heroui/react";
import {
  type CalendarDate,
  fromDate,
  getLocalTimeZone,
  toCalendarDate,
  today,
} from "@internationalized/date";
import {
  createExpense,
  updateExpense,
  type MutationResult,
} from "@/app/actions/expenses";
import type { ExpenseDTO } from "@/app/lib/data/expenses";
import type { CategoryDTO } from "@/app/lib/data/categories";

type ExpenseFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryDTO[];
  expense?: ExpenseDTO;
  onSaved: () => void;
};

function defaultDate(expense?: ExpenseDTO): CalendarDate {
  if (!expense) return today(getLocalTimeZone());
  return toCalendarDate(fromDate(new Date(expense.date), getLocalTimeZone()));
}

// The parent remounts this component (via a `key` that changes on every
// open) whenever it should show fresh field values — see ExpensesClient.
// That lets initial state come from plain lazy `useState` initializers
// instead of an effect that reaches back into React state.
export default function ExpenseFormModal({
  isOpen,
  onClose,
  categories,
  expense,
  onSaved,
}: ExpenseFormModalProps) {
  const isEdit = Boolean(expense);

  const [amount, setAmount] = useState(() => (expense ? String(expense.amount) : ""));
  const [categoryId, setCategoryId] = useState(() => expense?.categoryId ?? "");
  const [date, setDate] = useState<CalendarDate | null>(() => defaultDate(expense));
  const [description, setDescription] = useState(() => expense?.description ?? "");
  const [result, setResult] = useState<MutationResult>();
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!date) {
      setResult({ fieldErrors: { date: ["Enter a valid date"] } });
      return;
    }

    const input = {
      amount: Number(amount),
      categoryId,
      date: date.toDate(getLocalTimeZone()),
      description,
    };

    startTransition(async () => {
      const res =
        isEdit && expense
          ? await updateExpense(expense.id, input)
          : await createExpense(input);

      setResult(res);
      if (res.success) {
        addToast({
          title: isEdit ? "Expense updated" : "Expense added",
          color: "success",
        });
        onSaved();
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
        <ModalHeader>{isEdit ? "Edit expense" : "Add expense"}</ModalHeader>
        <ModalBody className="gap-4">
          {result?.error && <Alert color="danger">{result.error}</Alert>}

          <Input
            type="number"
            label="Amount"
            startContent="$"
            isRequired
            value={amount}
            onValueChange={setAmount}
            isInvalid={!!result?.fieldErrors?.amount}
            errorMessage={result?.fieldErrors?.amount?.[0]}
          />

          <Select
            label="Category"
            isRequired
            selectedKeys={categoryId ? [categoryId] : []}
            onSelectionChange={(keys) => {
              const [key] = Array.from(keys as Set<string>);
              setCategoryId(key ?? "");
            }}
            isInvalid={!!result?.fieldErrors?.categoryId}
            errorMessage={result?.fieldErrors?.categoryId?.[0]}
          >
            {categories.map((category) => (
              <SelectItem key={category.id}>{category.name}</SelectItem>
            ))}
          </Select>

          <DatePicker<CalendarDate>
            label="Date"
            isRequired
            value={date}
            onChange={setDate}
            isInvalid={!!result?.fieldErrors?.date}
            errorMessage={result?.fieldErrors?.date?.[0]}
          />

          <Textarea
            label="Description"
            maxLength={500}
            value={description}
            onValueChange={setDescription}
            description={`${description.length}/500`}
            isInvalid={!!result?.fieldErrors?.description}
            errorMessage={result?.fieldErrors?.description?.[0]}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" isLoading={isPending} onPress={handleSave}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
