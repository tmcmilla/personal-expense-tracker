import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();

vi.mock("mongoose", () => ({
  default: {
    connect: connectMock,
  },
}));

const ORIGINAL_URI = process.env.MONGODB_URI;

describe("connectToDatabase", () => {
  beforeEach(() => {
    vi.resetModules();
    connectMock.mockReset();
    // The module-level cache lives on globalThis so it survives Next.js's
    // dev-server module reloads; clear it between tests so tests don't leak
    // connection state into one another.
    (globalThis as Record<string, unknown>).mongooseCache = undefined;
    process.env.MONGODB_URI = "mongodb://localhost:27017/test";
  });

  afterEach(() => {
    process.env.MONGODB_URI = ORIGINAL_URI;
  });

  it("throws if MONGODB_URI is not set", async () => {
    delete process.env.MONGODB_URI;
    const { connectToDatabase } = await import("./mongodb");

    await expect(connectToDatabase()).rejects.toThrow(
      "Missing MONGODB_URI environment variable",
    );
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("connects using the configured MONGODB_URI with buffering disabled", async () => {
    const fakeConnection = { id: "fake-connection" };
    connectMock.mockResolvedValue(fakeConnection);

    const { connectToDatabase } = await import("./mongodb");
    const result = await connectToDatabase();

    expect(result).toBe(fakeConnection);
    expect(connectMock).toHaveBeenCalledWith(
      "mongodb://localhost:27017/test",
      { bufferCommands: false },
    );
  });

  it("reuses the cached connection instead of connecting twice", async () => {
    const fakeConnection = { id: "fake-connection" };
    connectMock.mockResolvedValue(fakeConnection);

    const { connectToDatabase } = await import("./mongodb");
    await connectToDatabase();
    await connectToDatabase();
    await connectToDatabase();

    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it("de-dupes concurrent callers onto a single in-flight connection promise", async () => {
    let resolveConnect: (value: unknown) => void;
    connectMock.mockReturnValue(
      new Promise((resolve) => {
        resolveConnect = resolve;
      }),
    );

    const { connectToDatabase } = await import("./mongodb");
    const first = connectToDatabase();
    const second = connectToDatabase();

    resolveConnect!({ id: "fake-connection" });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(firstResult).toBe(secondResult);
  });

  it("clears the cached promise on failure so the next call retries", async () => {
    connectMock
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValueOnce({ id: "fake-connection" });

    const { connectToDatabase } = await import("./mongodb");

    await expect(connectToDatabase()).rejects.toThrow("connection refused");
    const result = await connectToDatabase();

    expect(result).toEqual({ id: "fake-connection" });
    expect(connectMock).toHaveBeenCalledTimes(2);
  });
});
