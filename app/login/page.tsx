import Link from "next/link";
import type { Metadata } from "next";
import AuthCard from "@/app/components/AuthCard";

export const metadata: Metadata = {
  title: "Log in - Personal Expense Tracker",
};

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to keep tracking your expenses."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-black hover:underline dark:text-zinc-50"
          >
            Sign up
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4">
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
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-black dark:text-zinc-50"
            >
              Password
            </label>
            <Link
              href="#"
              className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-11 rounded-lg border border-black/[.08] bg-transparent px-3 text-sm text-black outline-none placeholder:text-zinc-400 focus:border-black/30 dark:border-white/[.145] dark:text-zinc-50 dark:focus:border-white/40"
          />
        </div>

        <button
          type="submit"
          className="mt-2 h-11 rounded-lg bg-foreground text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Log in
        </button>
      </form>
    </AuthCard>
  );
}
