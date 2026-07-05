import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifySessionMock,
  connectToDatabaseMock,
  revalidatePathMock,
  expenseCreateMock,
  expenseFindOneAndUpdateMock,
  expenseDeleteOneMock,
} = vi.hoisted(() => ({
  verifySessionMock: vi.fn(),
  connectToDatabaseMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  expenseCreateMock: vi.fn(),
  expenseFindOneAndUpdateMock: vi.fn(),
  expenseDeleteOneMock: vi.fn(),
}));

vi.mock("@/app/lib/dal", () => ({
  verifySession: verifySessionMock,
}));

vi.mock("@/lib/mongodb", () => ({
  connectToDatabase: connectToDatabaseMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/models/Expense", () => ({
  default: {
    create: expenseCreateMock,
    findOneAndUpdate: expenseFindOneAndUpdateMock,
    deleteOne: expenseDeleteOneMock,
  },
}));

import { createExpense, deleteExpense, updateExpense } from "./expenses";

const USER_ID = "user-123";
const EXPENSE_ID = "507f1f77bcf86cd799439011";

const validInput = {
  amount: 42.5,
  categoryId: "507f1f77bcf86cd799439012",
  date: new Date("2024-01-15"),
  description: "Groceries",
};

describe("expense Server Actions", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    verifySessionMock.mockReset().mockResolvedValue({ userId: USER_ID });
    connectToDatabaseMock.mockReset();
    revalidatePathMock.mockReset();
    expenseCreateMock.mockReset();
    expenseFindOneAndUpdateMock.mockReset();
    expenseDeleteOneMock.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("createExpense", () => {
    it("returns fieldErrors and never touches the database on invalid input", async () => {
      const result = await createExpense({ ...validInput, amount: -1 });

      expect(result.fieldErrors?.amount).toBeDefined();
      expect(expenseCreateMock).not.toHaveBeenCalled();
    });

    it("creates the expense scoped to the session's userId and revalidates", async () => {
      expenseCreateMock.mockResolvedValue({ _id: EXPENSE_ID });

      const result = await createExpense(validInput);

      expect(expenseCreateMock).toHaveBeenCalledWith({
        userId: USER_ID,
        ...validInput,
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/expenses");
      expect(result).toEqual({ success: true });
    });

    it("returns a generic error and logs the real one when the database throws", async () => {
      expenseCreateMock.mockRejectedValue(new Error("E11000 duplicate key"));

      const result = await createExpense(validInput);

      expect(result.error).toBe("Something went wrong. Please try again.");
      expect(result.error).not.toMatch(/E11000/);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("updateExpense", () => {
    it("returns a not-found message for a malformed expenseId without querying the database", async () => {
      const result = await updateExpense("not-an-id", validInput);

      expect(result.error).toBe("We couldn't find that. It may have been removed.");
      expect(expenseFindOneAndUpdateMock).not.toHaveBeenCalled();
    });

    it("returns fieldErrors on invalid input without querying the database", async () => {
      const result = await updateExpense(EXPENSE_ID, { ...validInput, amount: -1 });

      expect(result.fieldErrors?.amount).toBeDefined();
      expect(expenseFindOneAndUpdateMock).not.toHaveBeenCalled();
    });

    it("scopes the update by _id and userId in the same query", async () => {
      expenseFindOneAndUpdateMock.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: EXPENSE_ID }),
      });

      const result = await updateExpense(EXPENSE_ID, validInput);

      expect(expenseFindOneAndUpdateMock).toHaveBeenCalledWith(
        { _id: EXPENSE_ID, userId: USER_ID },
        { $set: validInput },
        { new: true },
      );
      expect(revalidatePathMock).toHaveBeenCalledWith("/expenses");
      expect(result).toEqual({ success: true });
    });

    it("returns the same not-found message when the id doesn't exist or isn't owned by the caller", async () => {
      expenseFindOneAndUpdateMock.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const result = await updateExpense(EXPENSE_ID, validInput);

      expect(result.error).toBe("We couldn't find that. It may have been removed.");
    });

    it("returns a generic error and logs the real one when the database throws", async () => {
      expenseFindOneAndUpdateMock.mockImplementation(() => {
        throw new Error("connection reset");
      });

      const result = await updateExpense(EXPENSE_ID, validInput);

      expect(result.error).toBe("Something went wrong. Please try again.");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("deleteExpense", () => {
    it("returns a not-found message for a malformed expenseId without querying the database", async () => {
      const result = await deleteExpense("not-an-id");

      expect(result.error).toBe("We couldn't find that. It may have been removed.");
      expect(expenseDeleteOneMock).not.toHaveBeenCalled();
    });

    it("scopes the delete by _id and userId in the same query", async () => {
      expenseDeleteOneMock.mockResolvedValue({ deletedCount: 1 });

      const result = await deleteExpense(EXPENSE_ID);

      expect(expenseDeleteOneMock).toHaveBeenCalledWith({
        _id: EXPENSE_ID,
        userId: USER_ID,
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/expenses");
      expect(result).toEqual({ success: true });
    });

    it("returns the same not-found message when zero documents match", async () => {
      expenseDeleteOneMock.mockResolvedValue({ deletedCount: 0 });

      const result = await deleteExpense(EXPENSE_ID);

      expect(result.error).toBe("We couldn't find that. It may have been removed.");
    });

    it("returns a generic error and logs the real one when the database throws", async () => {
      expenseDeleteOneMock.mockRejectedValue(new Error("connection reset"));

      const result = await deleteExpense(EXPENSE_ID);

      expect(result.error).toBe("Something went wrong. Please try again.");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
