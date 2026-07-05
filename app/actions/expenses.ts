"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/app/lib/dal";
import { connectToDatabase } from "@/lib/mongodb";
import {
  expenseSchema,
  objectIdSchema,
  type ExpenseInput,
} from "@/app/lib/validation/expense";
import Expense from "@/models/Expense";

export type MutationResult = {
  fieldErrors?: Record<string, string[]>;
  error?: string;
  success?: boolean;
};

const NOT_FOUND_MESSAGE = "We couldn't find that. It may have been removed.";
const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export async function createExpense(input: ExpenseInput): Promise<MutationResult> {
  const { userId } = await verifySession();

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await connectToDatabase();
    await Expense.create({ userId, ...parsed.data });
    revalidatePath("/expenses");
    return { success: true };
  } catch (err) {
    console.error("createExpense failed", err);
    return { error: GENERIC_ERROR_MESSAGE };
  }
}

export async function updateExpense(
  expenseId: string,
  input: ExpenseInput,
): Promise<MutationResult> {
  const { userId } = await verifySession();

  const idCheck = objectIdSchema.safeParse(expenseId);
  if (!idCheck.success) {
    return { error: NOT_FOUND_MESSAGE };
  }

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await connectToDatabase();
    const updated = await Expense.findOneAndUpdate(
      { _id: expenseId, userId },
      { $set: parsed.data },
      { new: true },
    ).lean();

    if (!updated) {
      return { error: NOT_FOUND_MESSAGE };
    }

    revalidatePath("/expenses");
    return { success: true };
  } catch (err) {
    console.error("updateExpense failed", err);
    return { error: GENERIC_ERROR_MESSAGE };
  }
}

export async function deleteExpense(expenseId: string): Promise<MutationResult> {
  const { userId } = await verifySession();

  const idCheck = objectIdSchema.safeParse(expenseId);
  if (!idCheck.success) {
    return { error: NOT_FOUND_MESSAGE };
  }

  try {
    await connectToDatabase();
    const result = await Expense.deleteOne({ _id: expenseId, userId });
    if (result.deletedCount === 0) {
      return { error: NOT_FOUND_MESSAGE };
    }

    revalidatePath("/expenses");
    return { success: true };
  } catch (err) {
    console.error("deleteExpense failed", err);
    return { error: GENERIC_ERROR_MESSAGE };
  }
}
