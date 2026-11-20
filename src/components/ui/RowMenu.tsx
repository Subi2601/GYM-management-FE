import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export interface RowMenuItem {
  label: string;
  icon: IconName;
  onClick: () => void;
  /** Red text (delete and other destructive actions; they still confirm() themselves). */
  danger?: boolean;
  /** Greyed out; `disabledReason` is the tooltip (e.g. "All Branches" is selected). */
  disabled?: boolean;
  disabledReason?: string;
}

const MENU_WIDTH = 220;

/**
 * "⋯" button for a table row's less frequent actions. The list is portalled to <body> with fixed positioning so the
 * table's scroll container never clips it; it flips above the button near the bottom of the screen. Hidden items
 * (no permission) are simply left out of `items` by the caller; nothing to show → no button.
 */
export function RowMenu({ items, label = "More actions" }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight ?? items.length * 40 + 12;
    const below = r.bottom + 6 + height <= window.innerHeight;
    setPos({
      top: below ? r.bottom + 6 : Math.max(8, r.top - 6 - height),
      left: Math.min(Math.max(8, r.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8),
    });
  }, [open, items.length]);

  // Close on outside click, Escape, scroll or resize (the fixed menu would drift away from its row).
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <>
      <button ref={buttonRef} type="button" className={cn("action-icon", open && "border-accent bg-accent-light text-accent")}
        title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}>
        <Icon name="more" className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div ref={menuRef} role="menu" style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: MENU_WIDTH }}
          className="fixed z-[1001] animate-dropdownIn overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-dropdown">
          {items.map((item) => (
            <span key={item.label} title={item.disabled ? item.disabledReason : undefined} className="block">
              <button type="button" role="menuitem" disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-lg border-none bg-transparent px-3 py-2 text-left text-sm font-semibold transition-colors",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                  item.danger ? "text-danger hover:enabled:bg-danger-soft" : "text-secondary-grey hover:enabled:bg-accent-light hover:enabled:text-accent",
                )}>
                <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            </span>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
