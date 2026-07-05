"use server";

import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";
import { signupSchema } from "@/app/lib/validation/auth";

export type SignupState = {
  fieldErrors?: Partial<Record<"name" | "email" | "password" | "confirmPassword", string[]>>;
  error?: string;
  success?: boolean;
};

export async function signup(
  _prevState: SignupState | undefined,
  formData: FormData,
): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password } = parsed.data;

  try {
    await connectToDatabase();

    const existing = await User.findOne({ email });
    if (existing) {
      return { error: "An account with this email already exists." };
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({ name, email, password: hashedPassword });

    return { success: true };
  } catch (err) {
    console.error("signup failed", err);
    return { error: "Something went wrong. Please try again." };
  }
}
