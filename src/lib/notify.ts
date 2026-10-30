import { create } from "zustand";

import { toApiError } from "@/lib/api-error";

export type NotificationType = "success" | "error";

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

interface NotificationState {
  items: Notification[];
  push: (message: string, type: NotificationType, durationMs: number) => void;
  remove: (id: number) => void;
}

let nextId = 0;
const MAX_VISIBLE = 3;

export const useNotifications = create<NotificationState>((set, get) => ({
  items: [],
  push: (message, type, durationMs) => {
    const id = nextId++;
    set({ items: [...get().items, { id, message, type }].slice(-MAX_VISIBLE) });
    window.setTimeout(() => get().remove(id), durationMs);
  },
  remove: (id) => set({ items: get().items.filter((n) => n.id !== id) }),
}));

/**
 * Toast policy: success uses the backend `message`; 4xx red 6s; 5xx / network red 8s.
 * Visuals are the original Stag notification (solid green / red, top-right).
 */
export const notify = {
  success(message: string | null | undefined): void {
    if (message) useNotifications.getState().push(message, "success", 3500);
  },
  error(error: unknown): void {
    const apiError = toApiError(error);
    const duration = apiError.status >= 500 || apiError.status === 0 ? 8000 : 6000;
    useNotifications.getState().push(apiError.message, "error", duration);
  },
  errorText(message: string): void {
    useNotifications.getState().push(message, "error", 6000);
  },
};
