"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/app/lib/dal";
import { connectToDatabase } from "@/lib/mongodb";
import {
  categorySchema,
  type CategoryInput,
} from "@/app/lib/validation/category";
import { objectIdSchema } from "@/app/lib/validation/expense";
import { UNCATEGORIZED_CATEGORY_NAME } from "@/app/lib/data/categories";
import ExpenseCategory from "@/models/ExpenseCategory";
import Expense from "@/models/Expense";

export type MutationResult = {
  fieldErrors?: Record<string, string[]>;
  error?: string;
  success?: boolean;
};

const NOT_FOUND_MESSAGE = "We couldn't find that. It may have been removed.";
const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
const DUPLICATE_NAME_MESSAGE = "You already have a category with this name.";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

function revalidateCategoryPaths() {
  revalidatePath("/expenses/categories");
  revalidatePath("/expenses");
}

export async function createCategory(
  input: CategoryInput,
): Promise<MutationResult> {
  const { userId } = await verifySession();

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await connectToDatabase();
    await ExpenseCategory.create({
      userId,
      name: parsed.data.name,
      isDefault: false,
    });
    revalidateCategoryPaths();
    return { success: true };
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return { fieldErrors: { name: [DUPLICATE_NAME_MESSAGE] } };
    }
    console.error("createCategory failed", err);
    return { error: GENERIC_ERROR_MESSAGE };
  }
}

// Deletes a user's own custom category and reassigns any expenses that
// referenced it to the shared "Uncategorized" system category, per
// docs/ui.md §5.5. Scoping the initial lookup by { _id, userId } excludes
// system defaults (userId: null) the same way every other mutation does,
// per docs/auth.md §5.
export async function deleteCategory(
  categoryId: string,
): Promise<MutationResult> {
  const { userId } = await verifySession();

  const idCheck = objectIdSchema.safeParse(categoryId);
  if (!idCheck.success) {
    return { error: NOT_FOUND_MESSAGE };
  }

  try {
    await connectToDatabase();

    const category = await ExpenseCategory.findOne({
      _id: categoryId,
      userId,
    }).lean();
    if (!category) {
      return { error: NOT_FOUND_MESSAGE };
    }

    const uncategorized = await ExpenseCategory.findOneAndUpdate(
      { userId: null, name: UNCATEGORIZED_CATEGORY_NAME },
      {
        $setOnInsert: {
          userId: null,
          name: UNCATEGORIZED_CATEGORY_NAME,
          isDefault: true,
        },
      },
      { upsert: true, new: true },
    ).lean();

    await Expense.updateMany(
      { userId, categoryId },
      { $set: { categoryId: uncategorized._id } },
    );

    await ExpenseCategory.deleteOne({ _id: categoryId, userId });

    revalidateCategoryPaths();
    return { success: true };
  } catch (err) {
    console.error("deleteCategory failed", err);
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
