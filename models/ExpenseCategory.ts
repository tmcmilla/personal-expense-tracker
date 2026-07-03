import "server-only";
import { Schema, model, models, type InferSchemaType } from "mongoose";

const expenseCategorySchema = new Schema(
  {
    // null = shared system default category, visible to every user
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// system default category names must be unique among themselves
// (MongoDB partial indexes only support "$exists: true", not false, so
// system categories store userId: null explicitly and we filter on that)
expenseCategorySchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { userId: null } },
);

// a user can't have two custom categories with the same name (case-insensitive);
// this compound index also serves userId-only lookups, so no separate { userId: 1 } index is needed
expenseCategorySchema.index(
  { userId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

export type ExpenseCategory = InferSchemaType<typeof expenseCategorySchema>;

export default models.ExpenseCategory ?? model("ExpenseCategory", expenseCategorySchema);
