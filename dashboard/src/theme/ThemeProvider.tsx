import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "system" | "light" | "dark";
type Resolved = "light" | "dark";

const STORAGE_KEY = "theme";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: Resolved;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [systemDark, setSystemDark] = useState<boolean>(prefersDark);

  // Follow the OS preference so "system" mode updates live.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: Resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const setTheme = (t: Theme) => {
    // "system" is the implicit default, so persist only explicit overrides.
    if (t === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
