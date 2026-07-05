import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Personal Expense Tracker",
  description: "Track and manage your personal expenses.",
};

// Sets the .dark class before hydration — from the user's explicit
// ThemeSwitch override (docs/ui.md §2) if one is stored, else system
// preference — so the theme never flashes light-then-dark on first paint.
const themeInitScript = `(function(){try{var stored=localStorage.getItem("expense-tracker:theme:v1");var isDark=stored?stored==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(isDark){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <HeroUIProvider>
          <ToastProvider />
          {children}
        </HeroUIProvider>
      </body>
      <Script
        id="theme-init"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: themeInitScript }}
      />
    </html>
  );
}
