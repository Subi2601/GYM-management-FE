import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Shows the spinner, appends "…", and disables the button (no double submit). */
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-grad text-white border-transparent shadow-btn-primary hover:enabled:-translate-y-0.5 hover:enabled:shadow-glow active:enabled:translate-y-0",
  secondary:
    "bg-surface text-secondary-grey border-line hover:enabled:border-accent hover:enabled:text-accent hover:enabled:shadow-glow",
  danger: "bg-transparent text-danger border-danger hover:enabled:bg-danger hover:enabled:text-white",
};

/** Stag Performance buttons: red-gradient primary that lifts on hover, outlined secondary, outlined danger. */
export function Button({ variant = "primary", loading = false, icon, disabled, className, children,
  type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold outline-none",
        "transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className={cn("h-4 w-4 animate-spin rounded-full border-2",
          variant === "secondary" ? "border-line border-t-accent" : "border-white/30 border-t-white")} />
      ) : icon}
      <span>{children}{loading ? "…" : ""}</span>
    </button>
  );
}
