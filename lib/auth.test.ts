import { describe, expect, it, vi } from "vitest";

const { connectToDatabaseMock, bcryptCompareMock, userFindOneMock } =
  vi.hoisted(() => ({
    connectToDatabaseMock: vi.fn(),
    bcryptCompareMock: vi.fn(),
    userFindOneMock: vi.fn(),
  }));

vi.mock("@/lib/mongodb", () => ({
  connectToDatabase: connectToDatabaseMock,
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: bcryptCompareMock,
  },
}));

vi.mock("@/models/User", () => ({
  default: {
    findOne: userFindOneMock,
  },
}));

// The real next-auth CredentialsProvider hardcodes its top-level `authorize`
// to `() => null` and tucks the caller's real implementation away under
// `.options.authorize` (see node_modules/next-auth/providers/credentials.js).
// Import it for real here so this test breaks if that shape ever changes.
import { authOptions } from "./auth";

function getAuthorize() {
  const provider = authOptions.providers[0] as unknown as {
    options: { authorize: (credentials: unknown) => Promise<unknown> };
  };
  return provider.options.authorize;
}

describe("authOptions session strategy", () => {
  it("uses JWT sessions, per docs/auth.md (Credentials + database sessions is unsupported)", () => {
    expect(authOptions.session?.strategy).toBe("jwt");
  });

  it("sets a 30 day max age", () => {
    expect(authOptions.session?.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("points the sign-in page at /login", () => {
    expect(authOptions.pages?.signIn).toBe("/login");
  });
});

describe("authorize()", () => {
  const validCredentials = {
    email: "user@example.com",
    password: "correct-password",
  };

  it("returns null when credentials fail loginSchema validation", async () => {
    const authorize = getAuthorize();

    const result = await authorize({ email: "not-an-email", password: "" });

    expect(result).toBeNull();
    expect(connectToDatabaseMock).not.toHaveBeenCalled();
  });

  it("returns null when no user matches the email (never reveals whether the account exists)", async () => {
    connectToDatabaseMock.mockResolvedValue(undefined);
    userFindOneMock.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });

    const authorize = getAuthorize();
    const result = await authorize(validCredentials);

    expect(result).toBeNull();
    expect(userFindOneMock).toHaveBeenCalledWith({ email: "user@example.com" });
  });

  it("selects the password field explicitly, since the schema marks it select: false", async () => {
    connectToDatabaseMock.mockResolvedValue(undefined);
    const selectMock = vi.fn().mockResolvedValue(null);
    userFindOneMock.mockReturnValue({ select: selectMock });

    const authorize = getAuthorize();
    await authorize(validCredentials);

    expect(selectMock).toHaveBeenCalledWith("+password");
  });

  it("returns null when the password doesn't match (same result shape as 'no such user')", async () => {
    connectToDatabaseMock.mockResolvedValue(undefined);
    userFindOneMock.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: { toString: () => "user-123" },
        name: "Jane Doe",
        email: "user@example.com",
        password: "hashed-password",
      }),
    });
    bcryptCompareMock.mockResolvedValue(false);

    const authorize = getAuthorize();
    const result = await authorize(validCredentials);

    expect(result).toBeNull();
    expect(bcryptCompareMock).toHaveBeenCalledWith(
      "correct-password",
      "hashed-password",
    );
  });

  it("returns only id/name/email on success, never the password hash", async () => {
    connectToDatabaseMock.mockResolvedValue(undefined);
    userFindOneMock.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: { toString: () => "user-123" },
        name: "Jane Doe",
        email: "user@example.com",
        password: "hashed-password",
      }),
    });
    bcryptCompareMock.mockResolvedValue(true);

    const authorize = getAuthorize();
    const result = await authorize(validCredentials);

    expect(result).toEqual({
      id: "user-123",
      name: "Jane Doe",
      email: "user@example.com",
    });
    expect(result).not.toHaveProperty("password");
  });
});

describe("jwt callback", () => {
  it("copies the user id onto token.sub on initial sign-in", async () => {
    const token = { sub: undefined } as Record<string, unknown>;
    const result = await authOptions.callbacks!.jwt!({
      token,
      user: { id: "user-123", email: "user@example.com" },
      account: null,
      profile: undefined,
      isNewUser: undefined,
    } as never);

    expect(result.sub).toBe("user-123");
  });

  it("leaves an existing token.sub untouched on subsequent requests (no `user` param)", async () => {
    const token = { sub: "user-123" } as Record<string, unknown>;
    const result = await authOptions.callbacks!.jwt!({
      token,
      user: undefined as never,
      account: null,
      profile: undefined,
      isNewUser: undefined,
    } as never);

    expect(result.sub).toBe("user-123");
  });
});

describe("session callback", () => {
  it("copies token.sub onto session.user.id", async () => {
    const session = { user: { name: "Jane" }, expires: "" } as never;
    const token = { sub: "user-123" } as never;

    const result = await authOptions.callbacks!.session!({
      session,
      token,
    } as never);

    expect((result as { user: { id: string } }).user.id).toBe("user-123");
  });

  it("does not set an id when the token has no sub", async () => {
    const session = { user: { name: "Jane" }, expires: "" } as Record<
      string,
      unknown
    >;
    const token = {} as never;

    const result = (await authOptions.callbacks!.session!({
      session,
      token,
    } as never)) as { user: { id?: string } };

    expect(result.user.id).toBeUndefined();
  });
});
