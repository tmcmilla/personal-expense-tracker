import { describe, expect, it } from "vitest";
import { expenseSchema, objectIdSchema } from "./expense";

const validInput = {
  amount: 42.5,
  categoryId: "507f1f77bcf86cd799439011",
  date: new Date("2024-01-15"),
  description: "Groceries",
};

describe("expenseSchema", () => {
  it("accepts a fully valid input", () => {
    const result = expenseSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive amount", () => {
    const result = expenseSchema.safeParse({ ...validInput, amount: 0 });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.amount?.[0]).toMatch(/greater than 0/);
  });

  it("rejects a missing amount", () => {
    const { amount: _amount, ...rest } = validInput;
    const result = expenseSchema.safeParse(rest);
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.amount).toBeDefined();
  });

  it("rejects a malformed categoryId", () => {
    const result = expenseSchema.safeParse({ ...validInput, categoryId: "not-an-id" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.categoryId?.[0]).toBe("Invalid id");
  });

  it("rejects an empty categoryId", () => {
    const result = expenseSchema.safeParse({ ...validInput, categoryId: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a date given as an ISO string", () => {
    const result = expenseSchema.safeParse({ ...validInput, date: "2024-01-15" });
    expect(result.success).toBe(true);
  });

  it("rejects an unparseable date", () => {
    const result = expenseSchema.safeParse({ ...validInput, date: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects a description over 500 characters", () => {
    const result = expenseSchema.safeParse({
      ...validInput,
      description: "x".repeat(501),
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.description?.[0]).toMatch(/500 characters/);
  });

  it("normalizes an empty description to undefined", () => {
    const result = expenseSchema.safeParse({ ...validInput, description: "" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.description).toBeUndefined();
  });

  it("accepts an absent description", () => {
    const { description: _description, ...rest } = validInput;
    const result = expenseSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });
});

describe("objectIdSchema", () => {
  it("accepts a well-formed 24-character hex id", () => {
    expect(objectIdSchema.safeParse("507f1f77bcf86cd799439011").success).toBe(true);
  });

  it("rejects a malformed id", () => {
    expect(objectIdSchema.safeParse("not-an-id").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(objectIdSchema.safeParse("").success).toBe(false);
  });
});
