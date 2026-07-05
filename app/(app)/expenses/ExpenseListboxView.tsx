"use client";

import {
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Listbox,
  ListboxItem,
} from "@heroui/react";
import { MoreVertical } from "lucide-react";
import { categoryColor } from "./categoryColor";
import type { ExpenseDTO } from "@/app/lib/data/expenses";
import type { CategoryDTO } from "@/app/lib/data/categories";

type ExpenseListboxViewProps = {
  expenses: ExpenseDTO[];
  categoryById: Map<string, CategoryDTO>;
  onEdit: (expense: ExpenseDTO) => void;
  onDelete: (expense: ExpenseDTO) => void;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export default function ExpenseListboxView({
  expenses,
  categoryById,
  onEdit,
  onDelete,
}: ExpenseListboxViewProps) {
  return (
    <Listbox aria-label="Expenses" items={expenses} variant="flat">
      {(expense) => {
        const category = categoryById.get(expense.categoryId);
        return (
          <ListboxItem
            key={expense.id}
            textValue={expense.description || "Expense"}
            endContent={
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label="Expense actions"
                  >
                    <MoreVertical size={18} aria-hidden="true" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Expense actions"
                  onAction={(key) => {
                    if (key === "edit") onEdit(expense);
                    if (key === "delete") onDelete(expense);
                  }}
                >
                  <DropdownItem key="edit">Edit</DropdownItem>
                  <DropdownItem key="delete" color="danger">
                    Delete
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            }
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span>{expense.description || "No description"}</span>
                <span className="font-medium">
                  {currencyFormatter.format(expense.amount)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-default-500 text-sm">
                  {dateFormatter.format(new Date(expense.date))}
                </span>
                <Chip
                  size="sm"
                  color={categoryColor(expense.categoryId)}
                  variant="flat"
                >
                  {category?.name ?? "Uncategorized"}
                </Chip>
              </div>
            </div>
          </ListboxItem>
        );
      }}
    </Listbox>
  );
}
