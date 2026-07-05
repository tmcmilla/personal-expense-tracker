// These model files are almost entirely Mongoose schema *declarations* —
// there are no custom methods, virtuals, or validators to unit test. What is
// worth guarding in isolation (no DB connection needed) is the schema
// configuration itself, since docs/auth.md's per-user data isolation
// guarantees depend directly on it: `User.password` staying `select: false`,
// and the userId-leading indexes that make every query in docs/auth.md §5
// both correct and the indexed access path.
import { describe, expect, it } from "vitest";
import type { IndexDefinition, IndexOptions } from "mongoose";
import User from "./User";
import Expense from "./Expense";
import ExpenseCategory from "./ExpenseCategory";
import MonthlySummary from "./MonthlySummary";

type IndexTuple = [IndexDefinition, IndexOptions];

describe("User schema", () => {
  it("marks password select: false so it's excluded from queries by default", () => {
    expect(User.schema.path("password").options.select).toBe(false);
  });

  it("requires and uniquely indexes email", () => {
    const emailOptions = User.schema.path("email").options;
    expect(emailOptions.required).toBe(true);
    expect(emailOptions.unique).toBe(true);
    expect(emailOptions.lowercase).toBe(true);
  });

  it("requires password", () => {
    expect(User.schema.path("password").options.required).toBe(true);
  });
});

describe("Expense schema", () => {
  it("requires userId, categoryId, amount, and date", () => {
    for (const field of ["userId", "categoryId", "amount", "date"]) {
      expect(Expense.schema.path(field).options.required).toBe(true);
    }
  });

  it("leads its indexes with userId, matching the userId-scoped access pattern in docs/auth.md", () => {
    const indexKeys = Expense.schema
      .indexes()
      .map(([keys]: IndexTuple) => keys);
    expect(indexKeys).toContainEqual({ userId: 1, date: -1 });
    expect(indexKeys).toContainEqual({ userId: 1, categoryId: 1 });
  });
});

describe("ExpenseCategory schema", () => {
  it("defaults userId to null for shared system categories", () => {
    expect(ExpenseCategory.schema.path("userId").options.default).toBeNull();
  });

  it("enforces a unique name only among system-default (userId: null) categories", () => {
    const partial = ExpenseCategory.schema
      .indexes()
      .find(([, opts]: IndexTuple) => opts.partialFilterExpression);
    expect(partial).toBeDefined();
    const [keys, opts] = partial!;
    expect(keys).toEqual({ name: 1 });
    expect(opts.unique).toBe(true);
    expect(opts.partialFilterExpression).toEqual({ userId: null });
  });

  it("enforces a unique, case-insensitive name per user", () => {
    const perUser = ExpenseCategory.schema
      .indexes()
      .find(([keys]: IndexTuple) => "userId" in keys && "name" in keys);
    expect(perUser).toBeDefined();
    const [, opts] = perUser!;
    expect(opts.unique).toBe(true);
    expect(opts.collation).toEqual({ locale: "en", strength: 2 });
  });
});

describe("MonthlySummary schema", () => {
  it("requires userId, year, month, and totalAmount", () => {
    for (const field of ["userId", "year", "month", "totalAmount"]) {
      expect(MonthlySummary.schema.path(field).options.required).toBe(true);
    }
  });

  it("constrains month to 1-12", () => {
    const monthOptions = MonthlySummary.schema.path("month").options;
    expect(monthOptions.min).toBe(1);
    expect(monthOptions.max).toBe(12);
  });

  it("enforces exactly one summary per user per month", () => {
    const [keys, opts] = MonthlySummary.schema.indexes()[0];
    expect(keys).toEqual({ userId: 1, year: 1, month: 1 });
    expect(opts.unique).toBe(true);
  });
});
