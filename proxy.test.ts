import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getTokenMock } = vi.hoisted(() => ({ getTokenMock: vi.fn() }));

vi.mock("next-auth/jwt", () => ({
  getToken: getTokenMock,
}));

import proxy, { config } from "./proxy";

function requestFor(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("proxy", () => {
  afterEach(() => {
    getTokenMock.mockReset();
  });

  it("redirects unauthenticated requests to a protected route to /login with a callbackUrl", async () => {
    getTokenMock.mockResolvedValue(null);

    const res = await proxy(requestFor("/dashboard"));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe("/dashboard");
  });

  it("lets an authenticated request through to a protected route", async () => {
    getTokenMock.mockResolvedValue({ sub: "user-123" });

    const res = await proxy(requestFor("/dashboard"));

    // NextResponse.next() carries the internal "middleware-rewrite"-style
    // marker rather than a redirect status.
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets an unauthenticated request through to /login (a public route)", async () => {
    getTokenMock.mockResolvedValue(null);

    const res = await proxy(requestFor("/login"));

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets an unauthenticated request through to /signup (a public route)", async () => {
    getTokenMock.mockResolvedValue(null);

    const res = await proxy(requestFor("/signup"));

    expect(res.status).toBe(200);
  });

  it("redirects an already-authenticated request away from /login to /", async () => {
    getTokenMock.mockResolvedValue({ sub: "user-123" });

    const res = await proxy(requestFor("/login"));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/");
  });

  it("redirects an already-authenticated request away from /signup to /", async () => {
    getTokenMock.mockResolvedValue({ sub: "user-123" });

    const res = await proxy(requestFor("/signup"));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/");
  });

  it("preserves the originally-requested path as callbackUrl for nested protected routes", async () => {
    getTokenMock.mockResolvedValue(null);

    const res = await proxy(requestFor("/expenses/123/edit"));

    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("callbackUrl")).toBe(
      "/expenses/123/edit",
    );
  });

  it("passes the shared NEXTAUTH_SECRET to getToken", async () => {
    const originalSecret = process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_SECRET = "test-secret";
    getTokenMock.mockResolvedValue(null);

    await proxy(requestFor("/login"));

    expect(getTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ secret: "test-secret" }),
    );

    process.env.NEXTAUTH_SECRET = originalSecret;
  });

  describe("matcher config", () => {
    it("excludes next-auth's own API routes, static assets, and favicon", () => {
      const matcher = config.matcher[0];
      expect(matcher).toContain("api/auth");
      expect(matcher).toContain("_next/static");
      expect(matcher).toContain("_next/image");
      expect(matcher).toContain("favicon.ico");
    });

    it("does not exempt other API routes from protection", () => {
      // Regression guard for docs/auth.md's security checklist item:
      // "verify the matcher excludes only static assets and api/auth, not
      // other API routes."
      const matcher = config.matcher[0];
      expect(matcher).not.toMatch(/api\/(?!auth\b)/);
    });
  });
});
