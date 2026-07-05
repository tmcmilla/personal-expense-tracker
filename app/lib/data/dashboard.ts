import "server-only";
import { Types } from "mongoose";
import { verifySession } from "@/app/lib/dal";
import { connectToDatabase } from "@/lib/mongodb";
import { getCategories } from "@/app/lib/data/categories";
import type { ExpenseDTO } from "@/app/lib/data/expenses";
import Expense from "@/models/Expense";

export type CategoryBreakdownDTO = {
  categoryId: string;
  categoryName: string;
  total: number;
  count: number;
};

export type DashboardSummaryDTO = {
  year: number;
  month: number;
  totalAmount: number;
  transactionCount: number;
  averagePerTransaction: number;
  byCategory: CategoryBreakdownDTO[];
};

export async function getDashboardSummary(
  year: number,
  month: number,
): Promise<DashboardSummaryDTO> {
  const { userId } = await verifySession();
  await connectToDatabase();

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const [categories, rows] = await Promise.all([
    getCategories(),
    // Mongoose's automatic string→ObjectId casting only applies to query
    // methods (find/findOne/etc.) — aggregate() sends the pipeline to the
    // driver as-is, so userId must be cast explicitly (see the same note
    // in app/lib/data/categories.ts).
    Expense.aggregate<{ _id: unknown; total: number; count: number }>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $gte: monthStart, $lt: monthEnd },
        },
      },
      {
        $group: {
          _id: "$categoryId",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const byCategory: CategoryBreakdownDTO[] = rows
    .map((row) => {
      const categoryId = String(row._id);
      return {
        categoryId,
        categoryName: categoryById.get(categoryId)?.name ?? "Uncategorized",
        total: row.total,
        count: row.count,
      };
    })
    .toSorted((a, b) => b.total - a.total);

  const totalAmount = byCategory.reduce((sum, entry) => sum + entry.total, 0);
  const transactionCount = byCategory.reduce((sum, entry) => sum + entry.count, 0);

  return {
    year,
    month,
    totalAmount,
    transactionCount,
    averagePerTransaction: transactionCount > 0 ? totalAmount / transactionCount : 0,
    byCategory,
  };
}

export async function getRecentExpenses(limit = 5): Promise<ExpenseDTO[]> {
  const { userId } = await verifySession();
  await connectToDatabase();

  const docs = await Expense.find({ userId })
    .sort({ date: -1 })
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    categoryId: String(doc.categoryId),
    amount: doc.amount,
    description: doc.description ?? null,
    date: doc.date.toISOString(),
  }));
}
