import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const THEME_STORAGE_KEY = "p6ix_theme_mode";
const THEMES = ["light", "mid", "dark"];

const ThemeContext = createContext({
  theme: "mid",
  setTheme: () => {},
  themes: THEMES,
});

function normalizeTheme(value) {
  return THEMES.includes(value) ? value : "mid";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      return "mid";
    }
  });

  useEffect(() => {
    const normalized = normalizeTheme(theme);
    document.documentElement.setAttribute("data-theme", normalized);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage failures
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(normalizeTheme(nextTheme));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      themes: THEMES,
    }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

