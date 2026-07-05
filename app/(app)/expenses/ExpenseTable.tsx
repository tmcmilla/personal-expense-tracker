"use client";

import {
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { MoreVertical } from "lucide-react";
import { categoryColor } from "./categoryColor";
import type { ExpenseDTO } from "@/app/lib/data/expenses";
import type { CategoryDTO } from "@/app/lib/data/categories";

type ExpenseTableProps = {
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

export default function ExpenseTable({
  expenses,
  categoryById,
  onEdit,
  onDelete,
}: ExpenseTableProps) {
  return (
    <Table aria-label="Expenses" isStriped>
      <TableHeader>
        <TableColumn>Date</TableColumn>
        <TableColumn>Category</TableColumn>
        <TableColumn>Description</TableColumn>
        <TableColumn align="end">Amount</TableColumn>
        <TableColumn align="end">Actions</TableColumn>
      </TableHeader>
      <TableBody items={expenses}>
        {(expense) => {
          const category = categoryById.get(expense.categoryId);
          return (
            <TableRow key={expense.id}>
              <TableCell>{dateFormatter.format(new Date(expense.date))}</TableCell>
              <TableCell>
                <Chip color={categoryColor(expense.categoryId)} variant="flat">
                  {category?.name ?? "Uncategorized"}
                </Chip>
              </TableCell>
              <TableCell>{expense.description || "—"}</TableCell>
              <TableCell className="text-right">
                {currencyFormatter.format(expense.amount)}
              </TableCell>
              <TableCell className="text-right">
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      isIconOnly
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
              </TableCell>
            </TableRow>
          );
        }}
      </TableBody>
    </Table>
  );
}
