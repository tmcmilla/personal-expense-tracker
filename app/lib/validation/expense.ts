import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const expenseSchema = z.object({
  amount: z
    .number("Amount is required")
    .positive("Amount must be greater than 0")
    .finite()
    .max(1_000_000_000, "Amount is too large"),
  categoryId: objectIdSchema, // empty/malformed string fails the same way as "choose a category"
  date: z.coerce.date({ error: "Enter a valid date" }),
  description: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().trim().max(500, "Keep it under 500 characters").optional(),
  ),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
