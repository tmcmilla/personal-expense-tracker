import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const {
  verifySessionMock,
  connectToDatabaseMock,
  findOneAndUpdateMock,
  findMock,
  aggregateMock,
} = vi.hoisted(() => ({
  verifySessionMock: vi.fn(),
  connectToDatabaseMock: vi.fn(),
  findOneAndUpdateMock: vi.fn(),
  findMock: vi.fn(),
  aggregateMock: vi.fn(),
}));

vi.mock("@/app/lib/dal", () => ({
  verifySession: verifySessionMock,
}));

vi.mock("@/lib/mongodb", () => ({
  connectToDatabase: connectToDatabaseMock,
}));

vi.mock("@/models/ExpenseCategory", () => ({
  default: {
    findOneAndUpdate: findOneAndUpdateMock,
    find: findMock,
  },
}));

vi.mock("@/models/Expense", () => ({
  default: {
    aggregate: aggregateMock,
  },
}));

import { getCategories } from "./categories";

const USER_ID = "507f1f77bcf86cd799439099";
const DEFAULT_CATEGORY_NAMES = [
  "Food",
  "Transport",
  "Housing",
  "Entertainment",
  "Other",
  "Uncategorized",
];

describe("getCategories", () => {
  beforeEach(() => {
    verifySessionMock.mockReset().mockResolvedValue({ userId: USER_ID });
    connectToDatabaseMock.mockReset();
    findOneAndUpdateMock.mockReset().mockResolvedValue(undefined);
    findMock.mockReset().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    });
    aggregateMock.mockReset().mockResolvedValue([]);
  });

  it("upserts each system default category by name, scoped to userId: null", async () => {
    await getCategories();

    expect(findOneAndUpdateMock).toHaveBeenCalledTimes(DEFAULT_CATEGORY_NAMES.length);
    for (const name of DEFAULT_CATEGORY_NAMES) {
      expect(findOneAndUpdateMock).toHaveBeenCalledWith(
        { userId: null, name },
        { $setOnInsert: { userId: null, name, isDefault: true } },
        { upsert: true },
      );
    }
  });

  it("queries system defaults and the caller's own categories", async () => {
    await getCategories();

    expect(findMock).toHaveBeenCalledWith({
      $or: [{ userId: null }, { userId: USER_ID }],
    });
  });

  it("maps documents to the DTO shape, defaulting expenseCount to 0", async () => {
    findMock.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: "507f1f77bcf86cd799439011", name: "Food", isDefault: true },
          { _id: "507f1f77bcf86cd799439012", name: "Custom", isDefault: false },
        ]),
      }),
    });

    const result = await getCategories();

    expect(result).toEqual([
      { id: "507f1f77bcf86cd799439011", name: "Food", isDefault: true, expenseCount: 0 },
      { id: "507f1f77bcf86cd799439012", name: "Custom", isDefault: false, expenseCount: 0 },
    ]);
  });

  it("merges per-category expense counts from the aggregate, scoped to the caller's userId", async () => {
    findMock.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: "507f1f77bcf86cd799439011", name: "Food", isDefault: true },
        ]),
      }),
    });
    aggregateMock.mockResolvedValue([
      { _id: "507f1f77bcf86cd799439011", count: 3 },
    ]);

    const result = await getCategories();

    expect(aggregateMock).toHaveBeenCalledWith([
      { $match: { userId: new Types.ObjectId(USER_ID) } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ]);
    expect(result).toEqual([
      {
        id: "507f1f77bcf86cd799439011",
        name: "Food",
        isDefault: true,
        expenseCount: 3,
      },
    ]);
  });

  it("never accepts userId as a parameter — it always comes from verifySession", () => {
    expect(getCategories).toHaveLength(0);
  });
});
