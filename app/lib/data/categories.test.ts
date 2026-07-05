import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifySessionMock,
  connectToDatabaseMock,
  findOneAndUpdateMock,
  findMock,
} = vi.hoisted(() => ({
  verifySessionMock: vi.fn(),
  connectToDatabaseMock: vi.fn(),
  findOneAndUpdateMock: vi.fn(),
  findMock: vi.fn(),
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

import { getCategories } from "./categories";

const USER_ID = "user-123";
const DEFAULT_CATEGORY_NAMES = ["Food", "Transport", "Housing", "Entertainment", "Other"];

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

  it("maps documents to the DTO shape", async () => {
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
      { id: "507f1f77bcf86cd799439011", name: "Food", isDefault: true },
      { id: "507f1f77bcf86cd799439012", name: "Custom", isDefault: false },
    ]);
  });

  it("never accepts userId as a parameter — it always comes from verifySession", () => {
    expect(getCategories).toHaveLength(0);
  });
});
