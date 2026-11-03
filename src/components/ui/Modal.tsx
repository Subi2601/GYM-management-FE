import { useEffect, useRef, type ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

/** Open modals / drawers, innermost last — Escape only closes the top one when they are stacked. */
const openStack: symbol[] = [];

/** Registers an open overlay: Escape closes only the topmost, and the page behind stops scrolling. */
export function useOverlay(open: boolean, onClose: () => void) {
  const id = useRef(Symbol("overlay")).current;

  useEffect(() => {
    if (!open) return;
    openStack.push(id);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      const i = openStack.lastIndexOf(id);
      if (i >= 0) openStack.splice(i, 1);
      if (openStack.length === 0) document.body.style.overflow = prevOverflow;
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
}

interface OverlayHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
}

function OverlayHeader({ title, subtitle, onClose }: OverlayHeaderProps) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
      <div className="min-w-0">
        <h2 className="m-0 text-[17px] font-extrabold tracking-[-0.01em] text-ink">{title}</h2>
        {subtitle && <p className="m-0 mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="-mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <Icon name="x" className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

/** Button row pinned to the bottom of a modal / drawer (Cancel left of the primary action). */
function OverlayFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col-reverse justify-end gap-2.5 border-t border-line bg-subtle px-6 py-3.5 sm:flex-row">
      {children}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  /** max-width (default 560px — popups are for short forms; long ones use a Drawer or a page). */
  width?: string;
  children: ReactNode;
  /** Buttons pinned below the scrolling body. Submit buttons point at the form with `form="<id>"`. */
  footer?: ReactNode;
  bodyClassName?: string;
}

/** Centered dialog for short forms, details and confirmations: fixed header and footer, scrolling body. */
export function Modal({ open, title, subtitle, onClose, width = "560px", children, footer, bodyClassName }: ModalProps) {
  useOverlay(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex animate-fadeIn items-center justify-center bg-[var(--backdrop)] p-4 backdrop-blur-[3px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[90vh] w-full animate-slideUp flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-modal"
        style={{ maxWidth: width }}
      >
        <OverlayHeader title={title} subtitle={subtitle} onClose={onClose} />
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", bodyClassName)}>{children}</div>
        {footer && <OverlayFooter>{footer}</OverlayFooter>}
      </div>
    </div>
  );
}

interface DrawerProps {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  /** Panel width (default 520px); full width on phones. */
  width?: string;
  children: ReactNode;
  /** Buttons pinned to the bottom. Submit buttons point at the form with `form="<id>"`. */
  footer?: ReactNode;
  bodyClassName?: string;
}

/** Right-side slide-over for medium forms (lead, plan, renew, payment …): the list stays visible behind it. */
export function Drawer({ open, title, subtitle, onClose, width = "520px", children, footer, bodyClassName }: DrawerProps) {
  useOverlay(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex animate-fadeIn justify-end bg-[var(--backdrop)] backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex h-full w-full animate-drawerIn flex-col border-l border-line bg-surface shadow-modal"
        style={{ maxWidth: width }}
      >
        <OverlayHeader title={title} subtitle={subtitle} onClose={onClose} />
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", bodyClassName)}>{children}</div>
        {footer && <OverlayFooter>{footer}</OverlayFooter>}
      </div>
    </div>
  );
}
