import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
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

// Sets the .dark class before hydration so system-preference dark mode
// (docs/ui.md §2) never flashes light-then-dark on first paint.
const themeInitScript = `(function(){try{if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.classList.add("dark");}}catch(e){}})();`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <HeroUIProvider>
          <ToastProvider />
          {children}
        </HeroUIProvider>
      </body>
    </html>
  );
}
