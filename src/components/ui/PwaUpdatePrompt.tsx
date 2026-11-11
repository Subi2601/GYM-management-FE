import { useRegisterSW } from "virtual:pwa-register/react";

import { Button } from "@/components/ui/Button";

/** How often an open app asks the server for a newer build (the gym desk keeps the app open all day). */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registers the PWA service worker and, when a new build is deployed, asks before switching to it
 * (reloading by surprise could lose a half-filled form). Renders nothing until an update is waiting.
 */
export function PwaUpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div role="status"
      className="fixed bottom-5 right-5 z-[99998] flex w-[calc(100%-40px)] max-w-[380px] flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-premium">
      <div className="text-sm text-ink">
        <strong className="block">A new version of Stag Fitness is ready</strong>
        <span className="text-muted">Save any open form, then reload to update.</span>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setNeedRefresh(false)}>Later</Button>
        <Button onClick={() => void updateServiceWorker(true)}>Reload</Button>
      </div>
    </div>
  );
}
