"use client";

import { useEffect, useState } from "react";

export type ChartTheme = {
  primary: string;
  primaryTransparent: string;
  mutedText: string;
  gridLine: string;
  prefersReducedMotion: boolean;
};

function readVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function resolveTheme(): ChartTheme {
  return {
    primary: `hsl(${readVar("--heroui-primary")})`,
    primaryTransparent: `hsl(${readVar("--heroui-primary")} / 0.15)`,
    mutedText: `hsl(${readVar("--heroui-default-500")})`,
    gridLine: `hsl(${readVar("--heroui-default-200")} / 0.5)`,
    prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

// Re-resolves whenever the `dark` class ThemeSwitch (app/(app)/ThemeSwitch.tsx)
// toggles on <html> changes, so a chart already on screen re-themes instantly
// instead of only on next mount/refetch.
export function useChartTheme(): ChartTheme {
  // Lazy initializer, not an effect — this hook is only ever mounted client-side
  // (charts are always loaded via next/dynamic with ssr:false), so resolving the
  // theme synchronously on first render is safe here.
  const [theme, setTheme] = useState<ChartTheme>(() => resolveTheme());

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(resolveTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
