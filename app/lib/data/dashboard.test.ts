import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const {
  verifySessionMock,
  connectToDatabaseMock,
  getCategoriesMock,
  aggregateMock,
  findMock,
} = vi.hoisted(() => ({
  verifySessionMock: vi.fn(),
  connectToDatabaseMock: vi.fn(),
  getCategoriesMock: vi.fn(),
  aggregateMock: vi.fn(),
  findMock: vi.fn(),
}));

vi.mock("@/app/lib/dal", () => ({
  verifySession: verifySessionMock,
}));

vi.mock("@/lib/mongodb", () => ({
  connectToDatabase: connectToDatabaseMock,
}));

vi.mock("@/app/lib/data/categories", () => ({
  getCategories: getCategoriesMock,
}));

vi.mock("@/models/Expense", () => ({
  default: {
    aggregate: aggregateMock,
    find: findMock,
  },
}));

import { getDashboardSummary, getRecentExpenses } from "./dashboard";

const USER_ID = "507f1f77bcf86cd799439099";

describe("getDashboardSummary", () => {
  beforeEach(() => {
    verifySessionMock.mockReset().mockResolvedValue({ userId: USER_ID });
    connectToDatabaseMock.mockReset();
    getCategoriesMock.mockReset().mockResolvedValue([]);
    aggregateMock.mockReset().mockResolvedValue([]);
  });

  it("scopes the aggregate to the caller's userId (cast to ObjectId) and the requested month", async () => {
    await getDashboardSummary(2026, 7);

    expect(aggregateMock).toHaveBeenCalledWith([
      {
        $match: {
          userId: new Types.ObjectId(USER_ID),
          date: {
            $gte: new Date(Date.UTC(2026, 6, 1)),
            $lt: new Date(Date.UTC(2026, 7, 1)),
          },
        },
      },
      {
        $group: {
          _id: "$categoryId",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);
  });

  it("returns zeroed totals for a month with no expenses", async () => {
    const result = await getDashboardSummary(2026, 7);

    expect(result).toEqual({
      year: 2026,
      month: 7,
      totalAmount: 0,
      transactionCount: 0,
      averagePerTransaction: 0,
      byCategory: [],
    });
  });

  it("joins category names, computes totals, and sorts by total descending", async () => {
    getCategoriesMock.mockResolvedValue([
      { id: "cat-1", name: "Food", isDefault: true, expenseCount: 2 },
      { id: "cat-2", name: "Transport", isDefault: true, expenseCount: 1 },
    ]);
    aggregateMock.mockResolvedValue([
      { _id: "cat-1", total: 40, count: 2 },
      { _id: "cat-2", total: 100, count: 1 },
    ]);

    const result = await getDashboardSummary(2026, 7);

    expect(result.byCategory).toEqual([
      { categoryId: "cat-2", categoryName: "Transport", total: 100, count: 1 },
      { categoryId: "cat-1", categoryName: "Food", total: 40, count: 2 },
    ]);
    expect(result.totalAmount).toBe(140);
    expect(result.transactionCount).toBe(3);
    expect(result.averagePerTransaction).toBeCloseTo(140 / 3);
  });

  it("falls back to Uncategorized for a categoryId with no matching category", async () => {
    aggregateMock.mockResolvedValue([{ _id: "cat-missing", total: 10, count: 1 }]);

    const result = await getDashboardSummary(2026, 7);

    expect(result.byCategory[0].categoryName).toBe("Uncategorized");
  });

  it("never accepts userId as a parameter — it always comes from verifySession", () => {
    expect(getDashboardSummary).toHaveLength(2);
  });
});

describe("getRecentExpenses", () => {
  beforeEach(() => {
    verifySessionMock.mockReset().mockResolvedValue({ userId: USER_ID });
    connectToDatabaseMock.mockReset();
    findMock.mockReset().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  it("queries only the session's own expenses, newest-first, limited to 5 by default", async () => {
    const sortMock = vi.fn();
    const limitMock = vi.fn();
    findMock.mockReturnValue({
      sort: sortMock.mockReturnValue({
        limit: limitMock.mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    await getRecentExpenses();

    expect(findMock).toHaveBeenCalledWith({ userId: USER_ID });
    expect(sortMock).toHaveBeenCalledWith({ date: -1 });
    expect(limitMock).toHaveBeenCalledWith(5);
  });

  it("maps documents to the ExpenseDTO shape", async () => {
    const date = new Date("2024-01-15T00:00:00.000Z");
    findMock.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            {
              _id: "507f1f77bcf86cd799439011",
              categoryId: "507f1f77bcf86cd799439012",
              amount: 42.5,
              description: undefined,
              date,
            },
          ]),
        }),
      }),
    });

    const result = await getRecentExpenses();

    expect(result).toEqual([
      {
        id: "507f1f77bcf86cd799439011",
        categoryId: "507f1f77bcf86cd799439012",
        amount: 42.5,
        description: null,
        date: date.toISOString(),
      },
    ]);
  });
});
