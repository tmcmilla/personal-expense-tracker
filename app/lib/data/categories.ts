import "server-only";
import { Types } from "mongoose";
import { verifySession } from "@/app/lib/dal";
import { connectToDatabase } from "@/lib/mongodb";
import ExpenseCategory from "@/models/ExpenseCategory";
import Expense from "@/models/Expense";

export const UNCATEGORIZED_CATEGORY_NAME = "Uncategorized";

const DEFAULT_CATEGORY_NAMES = [
  "Food",
  "Transport",
  "Housing",
  "Entertainment",
  "Other",
  UNCATEGORIZED_CATEGORY_NAME,
];

// Idempotent, concurrency-safe: each upsert is atomic at the database level,
// so simultaneous cold-start requests can't create duplicate system defaults.
async function ensureDefaultCategories() {
  await Promise.all(
    DEFAULT_CATEGORY_NAMES.map((name) =>
      ExpenseCategory.findOneAndUpdate(
        { userId: null, name },
        { $setOnInsert: { userId: null, name, isDefault: true } },
        { upsert: true },
      ),
    ),
  );
}

export type CategoryDTO = {
  id: string;
  name: string;
  isDefault: boolean;
  expenseCount: number;
};

export async function getCategories(): Promise<CategoryDTO[]> {
  const { userId } = await verifySession();
  await connectToDatabase();
  await ensureDefaultCategories();

  const [docs, counts] = await Promise.all([
    ExpenseCategory.find({
      $or: [{ userId: null }, { userId }],
    })
      .sort({ isDefault: -1, name: 1 })
      .lean(),
    // Mongoose's automatic string→ObjectId casting only applies to query
    // methods (find/findOne/etc.) — aggregate() sends the pipeline to the
    // driver as-is, so userId must be cast explicitly or this $match
    // silently matches nothing.
    Expense.aggregate<{ _id: unknown; count: number }>([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ]),
  ]);

  const countByCategoryId = new Map(
    counts.map((entry) => [String(entry._id), entry.count]),
  );

  return docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    isDefault: doc.isDefault ?? false,
    expenseCount: countByCategoryId.get(String(doc._id)) ?? 0,
  }));
}
