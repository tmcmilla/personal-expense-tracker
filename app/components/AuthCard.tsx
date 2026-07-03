import { ReactNode } from "react";

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 font-sans dark:bg-black">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            {title}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {subtitle}
          </p>
        </div>

        <div className="rounded-2xl border border-black/[.08] bg-white p-6 shadow-sm dark:border-white/[.145] dark:bg-zinc-950">
          {children}
        </div>

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {footer}
        </p>
      </div>
    </div>
  );
}
