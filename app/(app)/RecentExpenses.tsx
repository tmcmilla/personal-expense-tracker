"use client";

import { Card, CardBody, CardHeader, Chip, Listbox, ListboxItem } from "@heroui/react";
import { categoryColor } from "./categoryColor";
import LinkButton from "./LinkButton";
import type { ExpenseDTO } from "@/app/lib/data/expenses";
import type { CategoryDTO } from "@/app/lib/data/categories";

type RecentExpensesProps = {
  expenses: ExpenseDTO[];
  categories: CategoryDTO[];
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export default function RecentExpenses({
  expenses,
  categories,
}: RecentExpensesProps) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <Card>
      <CardHeader className="text-lg font-semibold">Recent expenses</CardHeader>
      <CardBody className="gap-3">
        <Listbox aria-label="Recent expenses" variant="flat">
          {expenses.map((expense) => {
            const category = categoryById.get(expense.categoryId);
            return (
              <ListboxItem
                key={expense.id}
                textValue={expense.description || "Expense"}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <span>{expense.description || "No description"}</span>
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
                  <span className="font-medium">
                    {currencyFormatter.format(expense.amount)}
                  </span>
                </div>
              </ListboxItem>
            );
          })}
        </Listbox>
        <LinkButton href="/expenses" variant="light" className="self-start">
          View all expenses
        </LinkButton>
      </CardBody>
    </Card>
  );
}
