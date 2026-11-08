import { forwardRef, useState, type InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  invalid?: boolean;
  /** Fills a generated password (the parent sets the field value). */
  onGenerate: () => void;
}

/** Password input with show / hide and a "Generate" button — the owner shares it by hand, so it starts visible. */
export const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(
  { invalid, onGenerate, ...rest }, ref) {
  const [visible, setVisible] = useState(true);
  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Input ref={ref} type={visible ? "text" : "password"} autoComplete="new-password" spellCheck={false}
          invalid={invalid} className="pr-10 font-mono" {...rest} />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted hover:text-ink">
          <Icon name={visible ? "eyeOff" : "eye"} className="h-4 w-4" />
        </button>
      </div>
      <button type="button" onClick={onGenerate}
        className="btn-status-action btn-grey inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <Icon name="refresh" className="h-3.5 w-3.5" /> Generate
      </button>
    </div>
  );
});
