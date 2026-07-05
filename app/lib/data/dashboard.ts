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

export type SpendOverTimePointDTO = {
  year: number;
  month: number;
  label: string;
  total: number;
};

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

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

export async function getSpendOverTime(
  monthsBack = 6,
): Promise<SpendOverTimePointDTO[]> {
  const { userId } = await verifySession();
  await connectToDatabase();

  const now = new Date();
  // Window start is the first day of the month `monthsBack - 1` months ago,
  // so the trailing window (inclusive of the current month) has exactly
  // `monthsBack` entries.
  const windowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsBack - 1), 1),
  );

  const rows = await Expense.aggregate<{
    _id: { year: number; month: number };
    total: number;
  }>([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        date: { $gte: windowStart },
      },
    },
    {
      $group: {
        _id: { year: { $year: "$date" }, month: { $month: "$date" } },
        total: { $sum: "$amount" },
      },
    },
  ]);

  const totalByKey = new Map(
    rows.map((row) => [`${row._id.year}-${row._id.month}`, row.total]),
  );

  const points: SpendOverTimePointDTO[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    points.push({
      year,
      month,
      label: MONTH_LABEL_FORMATTER.format(date),
      total: totalByKey.get(`${year}-${month}`) ?? 0,
    });
  }

  return points;
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
