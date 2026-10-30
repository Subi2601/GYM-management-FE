import { create } from "zustand";

/**
 * Branch the user is working in. `null` = "All Branches" (owners only, read-only aggregate).
 * Sent to the API as the X-Branch-ID header. The choice is remembered per browser (a convenience,
 * not state the server depends on) — the server re-validates it on every request.
 */
const STORAGE_KEY = "stag.selectedBranch";

function readStored(): string | null | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return undefined;
    return raw === "ALL" ? null : raw;
  } catch {
    return undefined;
  }
}

interface BranchState {
  /** undefined = not chosen yet (owners go to the branch-selection screen). */
  selectedBranchId: string | null | undefined;
  selectBranch: (branchId: string | null) => void;
  reset: () => void;
}

export const useBranchStore = create<BranchState>((set) => ({
  selectedBranchId: readStored(),
  selectBranch: (branchId) => {
    try {
      localStorage.setItem(STORAGE_KEY, branchId ?? "ALL");
    } catch {
      /* storage unavailable — selection still works for this tab */
    }
    set({ selectedBranchId: branchId });
  },
  reset: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    set({ selectedBranchId: undefined });
  },
}));
