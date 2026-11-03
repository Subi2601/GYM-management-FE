import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent,
  type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";

export interface RichOption<T extends string> {
  value: T;
  label: string;
  /** Short muted line under the label. */
  hint?: string;
  icon?: IconName;
}

export interface RichOptionGroup<T extends string> {
  label: string;
  options: RichOption<T>[];
}

interface RichSelectProps<T extends string> {
  id?: string;
  value: T | "";
  onChange: (value: T | "") => void;
  onBlur?: () => void;
  groups: RichOptionGroup<T>[];
  placeholder?: string;
  /** Adds a first option that clears the value (optional fields). */
  emptyOption?: string;
  /** Search box at the top of the list. */
  searchable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
}

const PANEL_MAX_HEIGHT = 340;
const GAP = 6;

/**
 * Styled dropdown for a small fixed list: grouped options with icon + hint, tick on the selected one,
 * optional search, keyboard (↑ ↓ Enter Esc, Tab closes). The list is portalled with fixed positioning so
 * drawers / modals with `overflow` never clip it; it opens upwards when there is no room below.
 */
export function RichSelect<T extends string>({ id, value, onChange, onBlur, groups, placeholder = "Select…",
  emptyOption, searchable = false, invalid, disabled }: RichSelectProps<T>) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number }>();

  const all = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const selected = all.find((o) => o.value === value);

  // Visible groups after search; `flat` is the keyboard order (the clear option first).
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, options: g.options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q)) }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);
  const flat = useMemo<(T | "")[]>(() => [
    ...(emptyOption && !query ? [""] as const : []),
    ...visible.flatMap((g) => g.options.map((o) => o.value)),
  ], [visible, emptyOption, query]);

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - GAP - 8;
    const above = r.top - GAP - 8;
    const up = below < Math.min(PANEL_MAX_HEIGHT, 240) && above > below;
    setPos({
      left: r.left, width: r.width,
      ...(up ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
      maxHeight: Math.min(PANEL_MAX_HEIGHT, up ? above : below),
    });
  }, []);

  const openList = () => {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, flat.indexOf(value)));
    place();
    setOpen(true);
  };
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);
  const choose = (v: T | "") => {
    onChange(v);
    close();
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true); // capture: any scrolling ancestor (drawer body)
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    (searchable ? searchRef.current : panelRef.current)?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) {
        setOpen(false);
        onBlur?.();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, searchable, onBlur]);

  // Keep the active option in view and reset it when the search changes.
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (open) panelRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onListKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (flat.length ? (a + step + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const v = flat[active];
      if (v !== undefined) choose(v);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // close the list, not the surrounding modal / drawer
      close();
    } else if (e.key === "Tab") {
      close(false);
      onBlur?.();
    }
  };

  const onTriggerKey = (e: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };

  const optionRow = (v: T | "", content: ReactNode, isSelected: boolean) => {
    const index = flat.indexOf(v);
    return (
      <div key={v || "__empty"} role="option" aria-selected={isSelected} data-index={index}
        onMouseEnter={() => setActive(index)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(v)}
        className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
          index === active && "bg-hover", isSelected && "bg-accent-light")}>
        {content}
        <Icon name="check" strokeWidth={3}
          className={cn("ml-auto h-4 w-4 text-accent", isSelected ? "opacity-100" : "opacity-0")} />
      </div>
    );
  };

  return (
    <>
      <button ref={triggerRef} id={id} type="button" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())} onKeyDown={onTriggerKey}
        onBlur={() => { if (!open) onBlur?.(); }} title={selected?.label}
        className={cn("form-control flex cursor-pointer items-center gap-2.5 text-left",
          open && "border-accent", invalid && "invalid")}
        style={open ? { boxShadow: "0 0 0 4px var(--ring)" } : undefined}>
        {selected?.icon && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-light text-accent">
            <Icon name={selected.icon} className="h-3.5 w-3.5" />
          </span>
        )}
        <span className={cn("min-w-0 flex-1 truncate", !selected && "font-normal text-muted/75")}>
          {selected?.label ?? placeholder}
        </span>
        <Icon name="chevronDown" className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && pos && createPortal(
        <div ref={panelRef} id={listId} role="listbox" tabIndex={-1} onKeyDown={onListKey}
          className="fixed z-[2100] flex animate-dropdownIn flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-dropdown outline-none"
          style={{ left: pos.left, width: Math.max(pos.width, 280), top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}>
          {searchable && (
            <label className="relative flex shrink-0 items-center border-b border-line">
              <Icon name="search" className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted" strokeWidth={2.5} />
              <input ref={searchRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…" aria-label="Search options" autoComplete="off"
                className="h-11 w-full border-0 bg-transparent pl-10 pr-3 text-sm font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted/80" />
            </label>
          )}
          <div className="min-h-0 overflow-y-auto p-1.5">
            {emptyOption && !query && optionRow("", (
              <span className="text-sm font-medium text-muted">{emptyOption}</span>
            ), value === "")}
            {visible.map((g) => (
              <div key={g.label} role="group" aria-label={g.label}>
                <div className="px-2.5 pb-1 pt-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted">{g.label}</div>
                {g.options.map((o) => optionRow(o.value, (
                  <>
                    {o.icon && (
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        o.value === value ? "bg-surface text-accent" : "bg-subtle text-secondary-grey")}>
                        <Icon name={o.icon} className="h-4 w-4" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className={cn("block truncate text-sm text-ink", o.value === value ? "font-bold" : "font-semibold")}>
                        {o.label}
                      </span>
                      {o.hint && <span className="block truncate text-xs text-muted">{o.hint}</span>}
                    </span>
                  </>
                ), o.value === value))}
              </div>
            ))}
            {visible.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted">No matches</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
