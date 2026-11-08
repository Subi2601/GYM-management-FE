import { useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi } from "@/features/auth/api";
import { apiDelete, apiGet, apiPut } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

/** GET /gym-profile — the gym's identity (Gym Settings page). */
export interface GymProfile {
  /** Gym ID (read-only). */
  code: string;
  name: string;
  tagline: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  invoice_footer: string | null;
  /** Public, versioned links (open without login). */
  logo_url: string | null;
  terms_url: string | null;
  terms_file_name: string | null;
}

export type GymProfileInput = Partial<Omit<GymProfile, "code" | "logo_url" | "terms_url" | "terms_file_name">>;

export interface GymFileUpload {
  file_name: string;
  content_type: string;
  data_base64: string;
}

export const gymKeys = { profile: ["gym-profile"] as const };

export const gymApi = {
  get: () => apiGet<GymProfile>("/gym-profile"),
  save: (body: GymProfileInput) => apiPut<GymProfile>("/gym-profile", body),
  upload: (kind: "logo" | "terms", body: GymFileUpload) => apiPut<GymProfile>(`/gym-profile/${kind}`, body),
  remove: (kind: "logo" | "terms") => apiDelete<GymProfile>(`/gym-profile/${kind}`),
};

export function useGymProfile() {
  return useQuery({ queryKey: gymKeys.profile, queryFn: async () => (await gymApi.get()).data, staleTime: 60_000 });
}

/** After a change: the profile, invoices, and the signed-in user (sidebar logo / name) refresh. */
export function useInvalidateGym() {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: gymKeys.profile }), qc.invalidateQueries({ queryKey: ["invoice"] })]);
    try {
      useAuthStore.getState().setMe((await authApi.me()).data);
    } catch {
      /* the next page load picks it up */
    }
  };
}

/** Absolute link to a public gym file (what a member opens from WhatsApp). */
export const publicUrl = (path: string | null | undefined) => (path ? `${window.location.origin}${path}` : null);

/** File → base64 upload body, or an error message. */
export function readGymFile(file: File, types: string[], maxBytes: number, what: string): Promise<GymFileUpload> {
  return new Promise((resolve, reject) => {
    if (!types.includes(file.type)) return reject(new Error(`Upload ${what}`));
    if (file.size > maxBytes) return reject(new Error(`Too big. Upload ${what}`));
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      resolve({ file_name: file.name.slice(0, 150), content_type: file.type, data_base64: text.slice(text.indexOf(",") + 1) });
    };
    reader.onerror = () => reject(new Error("Couldn't read the file"));
    reader.readAsDataURL(file);
  });
}
