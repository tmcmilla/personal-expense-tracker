import type { Metadata } from "next";
import { getExpenses } from "@/app/lib/data/expenses";
import { getCategories } from "@/app/lib/data/categories";
import ExpensesClient from "./ExpensesClient";

export const metadata: Metadata = {
  title: "Expenses | Personal Expense Tracker",
};

export default async function ExpensesPage() {
  const [expenses, categories] = await Promise.all([
    getExpenses(),
    getCategories(),
  ]);

  return <ExpensesClient expenses={expenses} categories={categories} />;
}
