/** Full-page loader (bootstrap / lazy routes) — the branch-selection spinner in Stag colours. */
export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-24">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-hover border-t-accent" />
      <p className="m-0 text-sm font-medium text-muted">{label}</p>
    </div>
  );
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-subtle">
      <div className="mb-4 flex items-center gap-3 text-[28px] font-extrabold tracking-[-1px] text-ink">
        <div className="h-8 w-2.5 rounded-md bg-gradient-to-br from-accent to-[#be123c]" />
        STAG <strong className="text-accent">FITNESS</strong>
      </div>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-hover border-t-accent" />
    </div>
  );
}
