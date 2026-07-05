"use client";

import { useLayoutEffect, useState } from "react";
import { Switch } from "@heroui/react";
import { Moon, Sun } from "lucide-react";

const THEME_STORAGE_KEY = "expense-tracker:theme:v1";

// Mirrors the pre-hydration script in app/layout.tsx: explicit override if
// stored, else system preference.
function resolveIsDark() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export default function ThemeSwitch() {
  // Always false on the initial render, matching the server (which has no
  // `document` and no knowledge of the pre-hydration script's class) —
  // reading the real DOM/localStorage state here instead would mismatch the
  // server-rendered markup and trigger a hydration error. The layout effect
  // below corrects it immediately after mount, before paint.
  const [isDark, setIsDark] = useState(false);

  // React's hydration commit can reset <html>'s class attribute back to its
  // static server-rendered value (see docs/ui.md §2), overwriting the class
  // app/layout.tsx's pre-hydration script set before paint. Re-assert the
  // resolved theme once the client has settled so it isn't silently lost.
  useLayoutEffect(() => {
    const resolved = resolveIsDark();
    document.documentElement.classList.toggle("dark", resolved);
    setIsDark(resolved);
  }, []);

  function handleChange(selected: boolean) {
    setIsDark(selected);
    document.documentElement.classList.toggle("dark", selected);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, selected ? "dark" : "light");
    } catch {
      // localStorage unavailable (private browsing, quota) — theme still
      // applies for this session, it just won't persist across reloads.
    }
  }

  return (
    <Switch
      aria-label="Toggle dark mode"
      isSelected={isDark}
      onValueChange={handleChange}
      thumbIcon={({ isSelected, className }) =>
        isSelected ? <Moon className={className} /> : <Sun className={className} />
      }
    />
  );
}
