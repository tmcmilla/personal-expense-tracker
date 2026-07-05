import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getServerSessionMock, redirectMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

// `redirect()` in Next.js works by throwing a special "NEXT_REDIRECT" error
// that the framework's rendering pipeline catches further up. Mimic that so
// verifySession() can't "fall through" and return a value after redirecting.
vi.mock("next/navigation", () => ({
  redirect: redirectMock.mockImplementation((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: { __marker: "test-auth-options" },
}));

describe("verifySession", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    getServerSessionMock.mockReset();
    redirectMock.mockClear();
  });

  it("returns the session's userId when a session with a user id exists", async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: "user-123" },
    });

    const { verifySession } = await import("./dal");
    const result = await verifySession();

    expect(result).toEqual({ userId: "user-123" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("calls getServerSession with the shared authOptions object", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-123" } });

    const { verifySession } = await import("./dal");
    await verifySession();

    expect(getServerSessionMock).toHaveBeenCalledWith({
      __marker: "test-auth-options",
    });
  });

  it("redirects to /login when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { verifySession } = await import("./dal");

    await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when the session has no user id", async () => {
    getServerSessionMock.mockResolvedValue({ user: {} });

    const { verifySession } = await import("./dal");

    await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /login when the session has no user at all", async () => {
    getServerSessionMock.mockResolvedValue({});

    const { verifySession } = await import("./dal");

    await expect(verifySession()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("never returns a userId sourced from anything but the verified session", async () => {
    // Guards the per-user data isolation rule in docs/auth.md §5: the only
    // way to get a userId out of this module is through the verified
    // session — there is no argument to pass a different one in.
    expect((await import("./dal")).verifySession).toHaveLength(0);
  });
});
