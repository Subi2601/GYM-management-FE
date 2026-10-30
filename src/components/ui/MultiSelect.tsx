import { useEffect, useRef, useState } from "react";

import { Checkbox } from "@/components/ui/Field";
import { cn } from "@/lib/utils";

export interface MultiSelectItem {
  id: string;
  label: string;
  subLabel?: string;
}

interface MultiSelectProps {
  items: MultiSelectItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

/** The original `stag-dropdown`: count bubble, checkbox list, Clear All / Done footer. */
export function MultiSelect({ items, selected, onChange, placeholder = "Select items..." }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((i) => i !== id) : [...selected, id]);

  const labels = items.filter((i) => selected.includes(i.id)).map((i) => i.label);
  const display = labels.length === 0 ? placeholder
    : labels.length <= 2 ? labels.join(", ") : `${labels[0]}, ${labels[1]} +${labels.length - 2} more`;

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-[46px] w-full cursor-pointer items-center gap-3 rounded-[10px] border border-line bg-surface px-4 py-2.5 text-left transition-all hover:border-line-strong hover:bg-subtle",
          open && "border-info bg-surface shadow-[0_0_0_3px_rgba(66,153,225,0.15)]",
        )}
      >
        {selected.length > 0 && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-info text-[11px] font-bold text-white">
            {selected.length}
          </span>
        )}
        <span className={cn("flex-1 truncate text-sm", selected.length ? "font-medium text-ink" : "text-muted")}>
          {display}
        </span>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={cn("text-muted transition-transform", open && "rotate-180 text-info")}>
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[1000] animate-dropdownIn overflow-hidden rounded-xl border border-line bg-surface shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]">
          {items.length === 0 ? (
            <div className="p-5 text-center text-sm text-muted">No items found</div>
          ) : (
            <>
              <div className="max-h-[280px] overflow-y-auto p-1.5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-subtle",
                      selected.includes(item.id) && "bg-info-soft")}
                  >
                    <span onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                    </span>
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-medium text-ink">{item.label}</span>
                      {item.subLabel && <span className="text-xs text-muted">{item.subLabel}</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-line-light bg-subtle px-3 py-2.5">
                <button type="button" onClick={() => onChange([])}
                  className="rounded px-2 py-1 text-[13px] font-semibold text-danger hover:bg-danger-soft">Clear All</button>
                <button type="button" onClick={() => setOpen(false)}
                  className="rounded-md bg-info px-3 py-1 text-[13px] font-semibold text-white hover:bg-info">Done</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
