import Link from "next/link";
import type { Metadata } from "next";
import AuthCard from "@/app/components/AuthCard";

export const metadata: Metadata = {
  title: "Sign up - Personal Expense Tracker",
};

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your account"
      subtitle="Start tracking your expenses in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-black hover:underline dark:text-zinc-50"
          >
            Log in
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="name"
            className="text-sm font-medium text-black dark:text-zinc-50"
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Jane Doe"
            className="h-11 rounded-lg border border-black/[.08] bg-transparent px-3 text-sm text-black outline-none placeholder:text-zinc-400 focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-sm font-medium text-black dark:text-zinc-50"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 rounded-lg border border-black/[.08] bg-transparent px-3 text-sm text-black outline-none placeholder:text-zinc-400 focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-black dark:text-zinc-50"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className="h-11 rounded-lg border border-black/[.08] bg-transparent px-3 text-sm text-black outline-none placeholder:text-zinc-400 focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-black dark:text-zinc-50"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            className="h-11 rounded-lg border border-black/[.08] bg-transparent px-3 text-sm text-black outline-none placeholder:text-zinc-400 focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
          />
        </div>

        <button
          type="submit"
          className="mt-2 h-11 rounded-lg bg-foreground text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Sign up
        </button>
      </form>
    </AuthCard>
  );
}
