import { createContext, type ReactNode, use, useCallback, useEffect, useMemo, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

interface ThemeValue {
  preference: ThemePreference;
  mode: "light" | "dark";
  setPreference: (p: ThemePreference) => void;
}

const KEY = "exo-theme";
const ThemeContext = createContext<ThemeValue | null>(null);

const readPreference = (): ThemePreference => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
};

const systemDark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [preference, setPref] = useState<ThemePreference>(readPreference);
  const [systemIsDark, setSystemIsDark] = useState(systemDark);

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => setSystemIsDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const mode = preference === "system" ? (systemIsDark ? "dark" : "light") : preference;
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies for this visit.
    }
  }, []);

  const value = useMemo(() => ({ preference, mode, setPreference }), [preference, mode, setPreference]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
};

export const useTheme = () => {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return ctx;
};
