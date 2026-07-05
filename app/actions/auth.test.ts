import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  connectToDatabaseMock,
  bcryptHashMock,
  userFindOneMock,
  userCreateMock,
} = vi.hoisted(() => ({
  connectToDatabaseMock: vi.fn(),
  bcryptHashMock: vi.fn(),
  userFindOneMock: vi.fn(),
  userCreateMock: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  connectToDatabase: connectToDatabaseMock,
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: bcryptHashMock,
  },
}));

vi.mock("@/models/User", () => ({
  default: {
    findOne: userFindOneMock,
    create: userCreateMock,
  },
}));

import { signup } from "./auth";

function formDataFrom(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

const validFields = {
  name: "Jane Doe",
  email: "jane@example.com",
  password: "password123",
  confirmPassword: "password123",
};

describe("signup server action", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    connectToDatabaseMock.mockReset();
    bcryptHashMock.mockReset();
    userFindOneMock.mockReset();
    userCreateMock.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns field errors and never touches the database on invalid input", async () => {
    const result = await signup(
      undefined,
      formDataFrom({ ...validFields, email: "not-an-email" }),
    );

    expect(result.fieldErrors?.email).toContain("Enter a valid email");
    expect(result.success).toBeUndefined();
    expect(result.error).toBeUndefined();
    expect(connectToDatabaseMock).not.toHaveBeenCalled();
  });

  it("returns field errors when password and confirmPassword don't match", async () => {
    const result = await signup(
      undefined,
      formDataFrom({ ...validFields, confirmPassword: "somethingElse123" }),
    );

    expect(result.fieldErrors?.confirmPassword).toContain(
      "Passwords don't match",
    );
    expect(connectToDatabaseMock).not.toHaveBeenCalled();
  });

  it("returns a generic duplicate-account error without leaking whether that's the exact reason to any other surface", async () => {
    connectToDatabaseMock.mockResolvedValue(undefined);
    userFindOneMock.mockResolvedValue({ _id: "existing-user" });

    const result = await signup(undefined, formDataFrom(validFields));

    expect(result).toEqual({
      error: "An account with this email already exists.",
    });
    expect(userCreateMock).not.toHaveBeenCalled();
  });

  it("hashes the password with a cost factor of at least 12 and never stores it in plaintext", async () => {
    connectToDatabaseMock.mockResolvedValue(undefined);
    userFindOneMock.mockResolvedValue(null);
    bcryptHashMock.mockResolvedValue("hashed-password");
    userCreateMock.mockResolvedValue({ _id: "new-user" });

    await signup(undefined, formDataFrom(validFields));

    expect(bcryptHashMock).toHaveBeenCalledWith("password123", 12);
    expect(userCreateMock).toHaveBeenCalledWith({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "hashed-password",
    });
  });

  it("returns success on a clean signup", async () => {
    connectToDatabaseMock.mockResolvedValue(undefined);
    userFindOneMock.mockResolvedValue(null);
    bcryptHashMock.mockResolvedValue("hashed-password");
    userCreateMock.mockResolvedValue({ _id: "new-user" });

    const result = await signup(undefined, formDataFrom(validFields));

    expect(result).toEqual({ success: true });
  });

  it("maps an unexpected database failure to a generic message and logs the real error server-side only", async () => {
    connectToDatabaseMock.mockResolvedValue(undefined);
    userFindOneMock.mockResolvedValue(null);
    bcryptHashMock.mockResolvedValue("hashed-password");
    const dbError = new Error(
      "E11000 duplicate key error collection: users index: email_1",
    );
    userCreateMock.mockRejectedValue(dbError);

    const result = await signup(undefined, formDataFrom(validFields));

    expect(result).toEqual({
      error: "Something went wrong. Please try again.",
    });
    // The raw Mongo/Mongoose error text must never reach the returned state.
    expect(JSON.stringify(result)).not.toContain("E11000");
    expect(consoleErrorSpy).toHaveBeenCalledWith("signup failed", dbError);
  });

  it("maps a connection failure to the same generic message", async () => {
    connectToDatabaseMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await signup(undefined, formDataFrom(validFields));

    expect(result).toEqual({
      error: "Something went wrong. Please try again.",
    });
  });
});
