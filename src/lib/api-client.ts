import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { ApiError } from "@/lib/api-error";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import type { Envelope } from "@/types/api";

export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
});

// Routes where a 401 is part of the normal flow and must not trigger refresh / session-expired.
const PUBLIC_AUTH_PATHS = ["/auth/login", "/auth/refresh"];

let onSessionExpired: (() => void) | null = null;

/** Registered once by the app shell so the interceptor can route without importing the router. */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const branchId = useBranchStore.getState().selectedBranchId;
  if (branchId && !config.headers["X-Branch-ID"]) config.headers["X-Branch-ID"] = branchId;
  return config;
});

interface RawEnvelope {
  success: boolean;
  message: string | null;
  data: unknown;
  total?: number;
  page?: number;
  page_size?: number;
}

/** Single-flight refresh: concurrent 401s share one /auth/refresh call. */
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = axios
      .post<RawEnvelope>("/api/v1/auth/refresh", undefined, { withCredentials: true })
      .then((r) => {
        const token = (r.data.data as { access_token?: string } | null)?.access_token ?? null;
        if (token) useAuthStore.getState().setToken(token);
        return token;
      })
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (response) => {
    const body = response.data as RawEnvelope | undefined;
    if (body && typeof body === "object" && "success" in body) {
      if (typeof body.total === "number") {
        response.data = {
          message: body.message ?? null,
          data: { items: body.data ?? [], total: body.total, page: body.page ?? 1, page_size: body.page_size ?? 20 },
        };
      } else {
        response.data = { message: body.message ?? null, data: body.data ?? null };
      }
    }
    return response;
  },
  async (error: AxiosError<{ message?: string; detail?: unknown }>) => {
    const status = error.response?.status ?? 0;
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const path = config?.url ?? "";
    const isPublicAuthCall = PUBLIC_AUTH_PATHS.some((p) => path.includes(p));

    // Access token expired mid-session → refresh once via the httpOnly cookie, then retry.
    if (status === 401 && config && !config._retried && !isPublicAuthCall
        && useAuthStore.getState().status === "authed") {
      config._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return api.request(config);
      }
      useAuthStore.getState().clear();
      onSessionExpired?.();
    }

    const detail = error.response?.data?.detail;
    const message =
      error.response?.data?.message ??
      (typeof detail === "string" ? detail : undefined) ??
      (status === 0 ? "Unable to reach the server. Check your connection." : "Something went wrong. Please try again.");
    return Promise.reject(new ApiError(message, status));
  },
);

// Thin typed helpers — no component ever touches response.data.data directly.

export async function apiGet<T>(url: string, params?: object): Promise<Envelope<T>> {
  const response = await api.get<Envelope<T>>(url, { params });
  return response.data;
}

export async function apiPost<T>(url: string, body?: object, params?: object): Promise<Envelope<T>> {
  const response = await api.post<Envelope<T>>(url, body, { params });
  return response.data;
}

export async function apiPut<T>(url: string, body?: object): Promise<Envelope<T>> {
  const response = await api.put<Envelope<T>>(url, body);
  return response.data;
}

export async function apiPatch<T>(url: string, body?: object): Promise<Envelope<T>> {
  const response = await api.patch<Envelope<T>>(url, body);
  return response.data;
}

export async function apiDelete<T>(url: string): Promise<Envelope<T>> {
  const response = await api.delete<Envelope<T>>(url);
  return response.data;
}

/** Strip "" / undefined / null so optional query params aren't sent. */
export function cleanParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== "" && v !== undefined && v !== null),
  ) as Partial<T>;
}
