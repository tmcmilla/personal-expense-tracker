import type { Metadata } from "next";
import { getCategories } from "@/app/lib/data/categories";
import CategoriesClient from "./CategoriesClient";

export const metadata: Metadata = {
  title: "Categories | Personal Expense Tracker",
};

export default async function CategoriesPage() {
  const categories = await getCategories();

  return <CategoriesClient categories={categories} />;
}
