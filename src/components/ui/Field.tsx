import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
  type TextareaHTMLAttributes } from "react";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: ReactNode;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
  hint?: ReactNode;
}

/** Label + control + inline error — the original ".form-group-modern". */
export function Field({ label, htmlFor, error, required, className, children, hint }: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="form-label">
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </label>
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-accent">
          <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={cn("form-control", invalid && "invalid", className)} {...rest} />;
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn("form-control", invalid && "invalid", className)} {...rest}>
      {children}
    </select>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn("form-control resize-y", invalid && "invalid", className)} {...rest} />;
});

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}

/** The original `stag-checkbox`. */
export function Checkbox({ checked, onChange, label, disabled }: CheckboxProps) {
  return (
    <label className={cn("relative inline-flex min-h-5 cursor-pointer select-none items-center pl-7 text-sm",
      disabled && "cursor-not-allowed opacity-60")}>
      <input type="checkbox" className="peer absolute h-0 w-0 opacity-0" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span className="absolute left-0 top-0 h-5 w-5 rounded-[6px] border-[1.5px] border-line-strong bg-surface transition-all
        peer-checked:border-transparent peer-checked:bg-grad peer-hover:border-accent peer-focus-visible:ring-4 peer-focus-visible:ring-[var(--ring)]
        after:absolute after:left-[5px] after:top-[1px] after:hidden after:h-[10px] after:w-[5px] after:rotate-45
        after:border-b-2 after:border-r-2 after:border-white after:content-[''] peer-checked:after:block" />
      {label && <span className="ml-1 text-ink">{label}</span>}
    </label>
  );
}
