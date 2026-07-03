import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";

const expenseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "ExpenseCategory",
      required: true,
    },
    amount: { type: Number, required: true },
    description: { type: String, trim: true, maxlength: 500 },
    // the transaction date, distinct from createdAt — monthly summaries group by this field
    date: { type: Date, required: true },
  },
  { timestamps: true },
);

// primary access pattern: a user's expenses in date order / range-filtered by month
expenseSchema.index({ userId: 1, date: -1 });
// filter/breakdown by category within a user's expenses
expenseSchema.index({ userId: 1, categoryId: 1 });

export type Expense = InferSchemaType<typeof expenseSchema>;

export default models.Expense ?? model("Expense", expenseSchema);
