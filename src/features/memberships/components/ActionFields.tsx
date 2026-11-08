import { useRef, useState } from "react";

import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { DOCUMENT_ACCEPT, openDocument, readDocument } from "@/features/memberships/api";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { DocumentUpload } from "@/types/membership";

/** Optional proof (doctor's note, letter …): PDF or photo ≤ 5 MB, sent with the action. */
export function DocumentField({ id, value, onChange }: {
  id: string; value: DocumentUpload | null; onChange: (doc: DocumentUpload | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  return (
    <Field label="Proof document" htmlFor={id} hint="Optional · PDF or photo, up to 5 MB" error={error}>
      <input ref={input} id={id} type="file" accept={DOCUMENT_ACCEPT} className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onChange(await readDocument(file));
            setError(undefined);
          } catch (err) {
            setError((err as Error).message);
          }
        }} />
      {value ? (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-subtle px-3 py-2 text-sm">
          <Icon name="file" className="h-4 w-4 shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate text-ink">{value.file_name}</span>
          <button type="button" className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-danger"
            onClick={() => onChange(null)}>Remove</button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-3 py-2.5 text-sm font-semibold text-secondary-grey hover:border-accent hover:text-accent">
          <Icon name="download" className="h-4 w-4 rotate-180" /> Attach file
        </button>
      )}
    </Field>
  );
}

/** A stored proof file: opens in a new tab. */
export function DocumentLink({ id, name, className }: { id: string; name: string; className?: string }) {
  return (
    <button type="button" title="Open proof"
      className={cn("inline-flex max-w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-xs font-semibold text-accent", className)}
      onClick={() => void openDocument(id).catch(notify.error)}>
      <Icon name="file" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{name}</span>
    </button>
  );
}

/** Small key figure in a status card. */
export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className={cn("mt-0.5 text-sm font-bold", tone ?? "text-ink")}>{value}</div>
    </div>
  );
}

/** Why the action isn't possible right now. */
export function Blocked({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-warning-line bg-warning-soft px-3.5 py-3 text-[13px] text-warning">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" /><span>{children}</span>
    </div>
  );
}
