import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionMock, connectToDatabaseMock, findMock } = vi.hoisted(() => ({
  verifySessionMock: vi.fn(),
  connectToDatabaseMock: vi.fn(),
  findMock: vi.fn(),
}));

vi.mock("@/app/lib/dal", () => ({
  verifySession: verifySessionMock,
}));

vi.mock("@/lib/mongodb", () => ({
  connectToDatabase: connectToDatabaseMock,
}));

vi.mock("@/models/Expense", () => ({
  default: {
    find: findMock,
  },
}));

import { getExpenses } from "./expenses";

const USER_ID = "user-123";

describe("getExpenses", () => {
  beforeEach(() => {
    verifySessionMock.mockReset().mockResolvedValue({ userId: USER_ID });
    connectToDatabaseMock.mockReset();
    findMock.mockReset();
  });

  it("queries only the session's own expenses, sorted newest-first", async () => {
    findMock.mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    });

    await getExpenses();

    expect(findMock).toHaveBeenCalledWith({ userId: USER_ID });
    const sortMock = findMock.mock.results[0].value.sort;
    expect(sortMock).toHaveBeenCalledWith({ date: -1 });
  });

  it("maps documents to the DTO shape with a string id and ISO date", async () => {
    const date = new Date("2024-01-15T00:00:00.000Z");
    findMock.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          {
            _id: "507f1f77bcf86cd799439011",
            categoryId: "507f1f77bcf86cd799439012",
            amount: 42.5,
            description: "Groceries",
            date,
          },
          {
            _id: "507f1f77bcf86cd799439013",
            categoryId: "507f1f77bcf86cd799439012",
            amount: 10,
            description: undefined,
            date,
          },
        ]),
      }),
    });

    const result = await getExpenses();

    expect(result).toEqual([
      {
        id: "507f1f77bcf86cd799439011",
        categoryId: "507f1f77bcf86cd799439012",
        amount: 42.5,
        description: "Groceries",
        date: date.toISOString(),
      },
      {
        id: "507f1f77bcf86cd799439013",
        categoryId: "507f1f77bcf86cd799439012",
        amount: 10,
        description: null,
        date: date.toISOString(),
      },
    ]);
  });

  it("never accepts userId as a parameter — it always comes from verifySession", () => {
    expect(getExpenses).toHaveLength(0);
  });
});
