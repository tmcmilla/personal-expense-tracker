import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifySessionMock,
  connectToDatabaseMock,
  revalidatePathMock,
  categoryCreateMock,
  categoryFindOneMock,
  categoryFindOneAndUpdateMock,
  categoryDeleteOneMock,
  expenseUpdateManyMock,
} = vi.hoisted(() => ({
  verifySessionMock: vi.fn(),
  connectToDatabaseMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  categoryCreateMock: vi.fn(),
  categoryFindOneMock: vi.fn(),
  categoryFindOneAndUpdateMock: vi.fn(),
  categoryDeleteOneMock: vi.fn(),
  expenseUpdateManyMock: vi.fn(),
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

vi.mock("@/models/ExpenseCategory", () => ({
  default: {
    create: categoryCreateMock,
    findOne: categoryFindOneMock,
    findOneAndUpdate: categoryFindOneAndUpdateMock,
    deleteOne: categoryDeleteOneMock,
  },
}));

vi.mock("@/models/Expense", () => ({
  default: {
    updateMany: expenseUpdateManyMock,
  },
}));

import { createCategory, deleteCategory } from "./categories";

const USER_ID = "user-123";
const CATEGORY_ID = "507f1f77bcf86cd799439011";
const UNCATEGORIZED_ID = "507f1f77bcf86cd799439099";

describe("category Server Actions", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    verifySessionMock.mockReset().mockResolvedValue({ userId: USER_ID });
    connectToDatabaseMock.mockReset();
    revalidatePathMock.mockReset();
    categoryCreateMock.mockReset();
    categoryFindOneMock.mockReset();
    categoryFindOneAndUpdateMock.mockReset();
    categoryDeleteOneMock.mockReset();
    expenseUpdateManyMock.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("createCategory", () => {
    it("returns fieldErrors and never touches the database on invalid input", async () => {
      const result = await createCategory({ name: "" });

      expect(result.fieldErrors?.name).toBeDefined();
      expect(categoryCreateMock).not.toHaveBeenCalled();
    });

    it("creates the category scoped to the session's userId and revalidates", async () => {
      categoryCreateMock.mockResolvedValue({ _id: CATEGORY_ID });

      const result = await createCategory({ name: "Groceries" });

      expect(categoryCreateMock).toHaveBeenCalledWith({
        userId: USER_ID,
        name: "Groceries",
        isDefault: false,
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/expenses/categories");
      expect(revalidatePathMock).toHaveBeenCalledWith("/expenses");
      expect(result).toEqual({ success: true });
    });

    it("maps a duplicate-key error to a field-level message instead of a generic one", async () => {
      categoryCreateMock.mockRejectedValue(
        Object.assign(new Error("E11000 duplicate key"), { code: 11000 }),
      );

      const result = await createCategory({ name: "Food" });

      expect(result.fieldErrors?.name?.[0]).toBe(
        "You already have a category with this name.",
      );
      expect(result.error).toBeUndefined();
    });

    it("returns a generic error and logs the real one for other failures", async () => {
      categoryCreateMock.mockRejectedValue(new Error("connection reset"));

      const result = await createCategory({ name: "Food" });

      expect(result.error).toBe("Something went wrong. Please try again.");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("deleteCategory", () => {
    it("returns a not-found message for a malformed categoryId without querying the database", async () => {
      const result = await deleteCategory("not-an-id");

      expect(result.error).toBe("We couldn't find that. It may have been removed.");
      expect(categoryFindOneMock).not.toHaveBeenCalled();
    });

    it("returns the same not-found message when the category doesn't exist or isn't owned by the caller", async () => {
      categoryFindOneMock.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

      const result = await deleteCategory(CATEGORY_ID);

      expect(categoryFindOneMock).toHaveBeenCalledWith({
        _id: CATEGORY_ID,
        userId: USER_ID,
      });
      expect(result.error).toBe("We couldn't find that. It may have been removed.");
      expect(categoryDeleteOneMock).not.toHaveBeenCalled();
    });

    it("reassigns the category's expenses to Uncategorized before deleting it", async () => {
      categoryFindOneMock.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: CATEGORY_ID }),
      });
      categoryFindOneAndUpdateMock.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: UNCATEGORIZED_ID }),
      });
      expenseUpdateManyMock.mockResolvedValue({ modifiedCount: 3 });
      categoryDeleteOneMock.mockResolvedValue({ deletedCount: 1 });

      const result = await deleteCategory(CATEGORY_ID);

      expect(categoryFindOneAndUpdateMock).toHaveBeenCalledWith(
        { userId: null, name: "Uncategorized" },
        {
          $setOnInsert: {
            userId: null,
            name: "Uncategorized",
            isDefault: true,
          },
        },
        { upsert: true, new: true },
      );
      expect(expenseUpdateManyMock).toHaveBeenCalledWith(
        { userId: USER_ID, categoryId: CATEGORY_ID },
        { $set: { categoryId: UNCATEGORIZED_ID } },
      );
      expect(categoryDeleteOneMock).toHaveBeenCalledWith({
        _id: CATEGORY_ID,
        userId: USER_ID,
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/expenses/categories");
      expect(revalidatePathMock).toHaveBeenCalledWith("/expenses");
      expect(result).toEqual({ success: true });
    });

    it("returns a generic error and logs the real one when the database throws", async () => {
      categoryFindOneMock.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: CATEGORY_ID }),
      });
      categoryFindOneAndUpdateMock.mockImplementation(() => {
        throw new Error("connection reset");
      });

      const result = await deleteCategory(CATEGORY_ID);

      expect(result.error).toBe("Something went wrong. Please try again.");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
