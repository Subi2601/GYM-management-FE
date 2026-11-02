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
      <div className="mb-4 flex items-center gap-3 font-display text-[32px] font-bold uppercase leading-none tracking-[0.5px] text-ink">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-grad text-xl text-white">S</div>
        Stag <span className="text-gradient">Fitness</span>
      </div>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-hover border-t-accent" />
    </div>
  );
}
