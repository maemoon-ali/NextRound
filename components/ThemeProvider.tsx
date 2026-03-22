"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Theme = "dark" | "light";

interface ThemeCtxValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeCtx = createContext<ThemeCtxValue>({ theme: "dark", toggle: () => {} });

/** Routes that must always render in dark mode regardless of user preference. */
const ALWAYS_DARK_ROUTES = ["/"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const pathname = usePathname();
  const alwaysDark = ALWAYS_DARK_ROUTES.includes(pathname);

  // Load saved preference from localStorage on first mount
  useEffect(() => {
    const saved = localStorage.getItem("nr-theme") as Theme | null;
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  // Apply theme class to <html>.
  // Homepage is always dark; all other pages use the saved/default theme.
  useEffect(() => {
    const root = document.documentElement;
    const effective = alwaysDark ? "dark" : theme;
    root.classList.toggle("dark", effective === "dark");
    root.classList.toggle("light", effective === "light");
    // Never overwrite the user's saved preference from the homepage.
    if (!alwaysDark) {
      localStorage.setItem("nr-theme", theme);
    }
  }, [theme, alwaysDark]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
