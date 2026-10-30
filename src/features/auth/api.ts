import { apiGet, apiPost } from "@/lib/api-client";
import type { Me, TokenResponse } from "@/types/auth";

export const authApi = {
  login: (email: string, password: string) => apiPost<TokenResponse>("/auth/login", { email, password }),
  refresh: () => apiPost<TokenResponse>("/auth/refresh"),
  me: () => apiGet<Me>("/auth/me"),
  logout: () => apiPost<null>("/auth/logout"),
  changePassword: (current_password: string, new_password: string) =>
    apiPost<null>("/auth/change-password", { current_password, new_password }),
};
