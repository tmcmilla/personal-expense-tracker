import "server-only";
import { verifySession } from "@/app/lib/dal";
import { connectToDatabase } from "@/lib/mongodb";
import ExpenseCategory from "@/models/ExpenseCategory";

const DEFAULT_CATEGORY_NAMES = [
  "Food",
  "Transport",
  "Housing",
  "Entertainment",
  "Other",
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
};

export async function getCategories(): Promise<CategoryDTO[]> {
  const { userId } = await verifySession();
  await connectToDatabase();
  await ensureDefaultCategories();

  const docs = await ExpenseCategory.find({
    $or: [{ userId: null }, { userId }],
  })
    .sort({ isDefault: -1, name: 1 })
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    isDefault: doc.isDefault ?? false,
  }));
}
