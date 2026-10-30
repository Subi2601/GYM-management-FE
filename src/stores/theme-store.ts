import { create } from "zustand";

export type Theme = "light" | "dark";

/**
 * White / dark theme. First visit follows the OS setting; an explicit choice is remembered per browser.
 * index.html applies the stored class before React mounts, so there is no flash on reload.
 */
const STORAGE_KEY = "stag.theme";

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage unavailable — fall back to the OS setting */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const theme = initialTheme();
  apply(theme);
  return {
    theme,
    toggle: () => {
      const next: Theme = get().theme === "dark" ? "light" : "dark";
      apply(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* choice still applies for this tab */
      }
      set({ theme: next });
    },
  };
});
