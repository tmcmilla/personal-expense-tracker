import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "./auth";

describe("loginSchema", () => {
  it("accepts a valid email/password payload", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "anything",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        email: "user@example.com",
        password: "anything",
      });
    }
  });

  it("trims and lowercases the email", () => {
    const result = loginSchema.safeParse({
      email: "  User@Example.com  ",
      password: "anything",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects a missing email", () => {
    const result = loginSchema.safeParse({ password: "anything" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty email with the required-field message", () => {
    const result = loginSchema.safeParse({ email: "", password: "anything" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toContain(
        "Email is required",
      );
    }
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "anything",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toContain(
        "Enter a valid email",
      );
    }
  });

  it("rejects a missing password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain(
        "Password is required",
      );
    }
  });
});

describe("signupSchema", () => {
  const validPayload = {
    name: "Jane Doe",
    email: "jane@example.com",
    password: "password123",
    confirmPassword: "password123",
  };

  it("accepts a valid payload", () => {
    const result = signupSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("trims the name and normalizes the email", () => {
    const result = signupSchema.safeParse({
      ...validPayload,
      name: "  Jane Doe  ",
      email: "  Jane@Example.com  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Jane Doe");
      expect(result.data.email).toBe("jane@example.com");
    }
  });

  it("rejects a missing name", () => {
    const result = signupSchema.safeParse({ ...validPayload, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "Name is required",
      );
    }
  });

  it("rejects a name that is only whitespace", () => {
    const result = signupSchema.safeParse({ ...validPayload, name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = signupSchema.safeParse({
      ...validPayload,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toContain(
        "Enter a valid email",
      );
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({
      ...validPayload,
      password: "short1",
      confirmPassword: "short1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toContain(
        "At least 8 characters",
      );
    }
  });

  it("rejects mismatched passwords and attaches the error to confirmPassword", () => {
    const result = signupSchema.safeParse({
      ...validPayload,
      password: "password123",
      confirmPassword: "somethingElse123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.confirmPassword).toContain("Passwords don't match");
      // The mismatch is a cross-field rule, so it must not also appear
      // attached to `password` itself.
      expect(fieldErrors.password).toBeUndefined();
    }
  });

  it("rejects a payload missing multiple required fields", () => {
    const result = signupSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.name).toBeDefined();
      expect(fieldErrors.email).toBeDefined();
      expect(fieldErrors.password).toBeDefined();
    }
  });
});
