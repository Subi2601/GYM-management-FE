import type { Config } from "tailwindcss";

// Stag Performance theme — white and dark (black + soft red gradient). Components use these
// tokens, never raw hex; the values live in src/index.css.
const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Theme tokens: RGB channels in CSS variables (index.css, light + .dark) so both themes and
      // opacity modifiers like accent/30 work from the same class names.
      colors: {
        main: c("main"),
        surface: c("surface"),
        card: c("surface"),
        subtle: c("subtle"),
        hover: c("hover"),
        "primary-grey": c("primary-grey"),
        "secondary-grey": c("secondary-grey"),
        ink: c("ink"),
        muted: c("muted"),
        faint: c("faint"),
        accent: { DEFAULT: c("accent"), light: c("accent-light"), dark: c("accent-dark") },
        line: { light: c("line-light"), DEFAULT: c("line"), strong: c("line-strong"), accent: c("line-accent") },
        success: { DEFAULT: c("success"), soft: c("success-soft"), line: c("success-line") },
        warning: { DEFAULT: c("warning"), soft: c("warning-soft"), line: c("warning-line") },
        danger: { DEFAULT: c("danger"), soft: c("danger-soft"), line: c("danger-line") },
        info: { DEFAULT: c("info"), soft: c("info-soft"), line: c("info-line") },
        plum: { DEFAULT: c("plum"), soft: c("plum-soft"), line: c("plum-line") },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        display: ["'Bebas Neue'", "'Plus Jakarta Sans'", "sans-serif"],
      },
      backgroundImage: {
        grad: "var(--grad)",
        "grad-text": "var(--grad-text)",
      },
      boxShadow: {
        subtle: "var(--shadow-subtle)",
        premium: "var(--shadow-premium)",
        glow: "var(--glow)",
        "btn-primary": "0 6px 14px -8px rgba(180, 35, 35, 0.45)",
        modal: "0 20px 25px -5px rgba(0, 0, 0, 0.18), 0 10px 10px -5px rgba(0, 0, 0, 0.06)",
        dropdown: "0 10px 25px rgba(0, 0, 0, 0.18)",
      },
      spacing: {
        sidebar: "var(--sidebar-width)",
        header: "var(--header-height)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { transform: "translateY(20px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        slideIn: { from: { transform: "translateX(120%)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        dropdownIn: { from: { opacity: "0", transform: "translateY(-10px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
      },
      animation: {
        fadeIn: "fadeIn 0.2s ease-out",
        slideUp: "slideUp 0.3s ease-out",
        slideIn: "slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        dropdownIn: "dropdownIn 0.2s ease-out",
        shimmer: "shimmer 1.2s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
