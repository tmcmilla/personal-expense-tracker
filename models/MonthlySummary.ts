import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";

const byCategorySchema = new Schema(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "ExpenseCategory",
      required: true,
    },
    // denormalized snapshot so the breakdown still reads correctly if the category is later renamed
    categoryName: { type: String, required: true },
    total: { type: Number, required: true },
    count: { type: Number, required: true },
  },
  { _id: false },
);

const monthlySummarySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    totalAmount: { type: Number, required: true },
    byCategory: { type: [byCategorySchema], default: [] },
  },
  { timestamps: true },
);

// exactly one summary per user per month; also the lookup key dashboards use
monthlySummarySchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

export type MonthlySummary = InferSchemaType<typeof monthlySummarySchema>;

export default models.MonthlySummary ?? model("MonthlySummary", monthlySummarySchema);
