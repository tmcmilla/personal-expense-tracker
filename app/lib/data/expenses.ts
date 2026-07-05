import "server-only";
import { verifySession } from "@/app/lib/dal";
import { connectToDatabase } from "@/lib/mongodb";
import Expense from "@/models/Expense";

export type ExpenseDTO = {
  id: string;
  categoryId: string;
  amount: number;
  description: string | null;
  date: string; // ISO string — plain JSON-safe across the server/client boundary
};

export async function getExpenses(): Promise<ExpenseDTO[]> {
  const { userId } = await verifySession();
  await connectToDatabase();

  const docs = await Expense.find({ userId }).sort({ date: -1 }).lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    categoryId: String(doc.categoryId),
    amount: doc.amount,
    description: doc.description ?? null,
    date: doc.date.toISOString(),
  }));
}
