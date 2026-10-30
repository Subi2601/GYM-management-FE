import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Open modals, innermost last — Escape only closes the top one when modals are stacked. */
const openStack: symbol[] = [];

interface ModalProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  /** max-width, as the original `width` input (default 800px). */
  width?: string;
  children: ReactNode;
  bodyClassName?: string;
}

/** The original `app-modal`: blurred overlay, rounded card, grey header bar, × close. */
export function Modal({ open, title, onClose, width = "800px", children, bodyClassName }: ModalProps) {
  const id = useRef(Symbol("modal")).current;

  useEffect(() => {
    if (!open) return;
    openStack.push(id);
    return () => {
      const i = openStack.lastIndexOf(id);
      if (i >= 0) openStack.splice(i, 1);
    };
  }, [open, id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openStack[openStack.length - 1] === id) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, id]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex animate-fadeIn items-center justify-center bg-[rgba(17,24,39,0.4)] backdrop-blur-[4px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-[90vh] w-[95%] animate-slideUp overflow-y-auto rounded-2xl border border-line bg-surface shadow-modal"
        style={{ maxWidth: width }}
      >
        <div className="sticky top-0 z-10 h-[3px] bg-grad" aria-hidden="true" />
        <div className="sticky top-[3px] z-10 flex items-center justify-between border-b border-line-light bg-subtle px-8 py-5">
          <h3 className="m-0 text-lg font-extrabold tracking-[-0.01em] text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-lg text-muted transition-all hover:border-accent hover:text-accent"
          >
            &times;
          </button>
        </div>
        <div className={cn("p-8", bodyClassName)}>{children}</div>
      </div>
    </div>
  );
}
