import { create } from "zustand";

import { Button } from "@/components/ui/Button";

interface ConfirmState {
  message: string | null;
  resolve: ((ok: boolean) => void) | null;
  ask: (message: string) => Promise<boolean>;
  answer: (ok: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  message: null,
  resolve: null,
  ask: (message) => new Promise<boolean>((resolve) => set({ message, resolve })),
  answer: (ok) => {
    get().resolve?.(ok);
    set({ message: null, resolve: null });
  },
}));

/** `if (await confirm("Delete X?")) …` — same contract as the original ConfirmService. */
export function confirm(message: string): Promise<boolean> {
  return useConfirmStore.getState().ask(message);
}

/** Mounted once in the app root. */
export function ConfirmHost() {
  const message = useConfirmStore((s) => s.message);
  const answer = useConfirmStore((s) => s.answer);
  if (message === null) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
      <div className="w-[90%] max-w-[400px] rounded-xl bg-surface p-6 text-center shadow-[0_20px_25px_-5px_rgba(0,0,0,0.2)]">
        <h3 className="mb-[15px] mt-0 text-lg font-bold text-ink">Confirmation</h3>
        <div className="mb-[25px] text-[15px] leading-normal text-secondary-grey">{message}</div>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => answer(false)}>No</Button>
          <Button onClick={() => answer(true)} autoFocus>Yes, Proceed</Button>
        </div>
      </div>
    </div>
  );
}
