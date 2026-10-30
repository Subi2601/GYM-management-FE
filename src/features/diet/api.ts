import { apiDelete, apiGet, apiPost, apiPut, cleanParams } from "@/lib/api-client";
import { ApiError } from "@/lib/api-error";
import { ALL_ROWS, type PageQuery, type Paginated } from "@/types/api";
import type { DietPlan, DietPlanItemCreate, DietPlanUpsert, DietShareText, EligibleMember, FoodItem } from "@/types/diet";

export const dietApi = {
  eligible: (query: PageQuery) =>
    apiGet<Paginated<EligibleMember>>("/diet-plans/eligible-members", cleanParams(query)),
  /** The member's plan, or null when none has been configured yet (backend 404). */
  plan: async (memberId: string): Promise<DietPlan | null> => {
    try {
      return (await apiGet<DietPlan>(`/diet-plans/member/${memberId}`)).data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  shareText: (memberId: string) => apiGet<DietShareText>(`/diet-plans/member/${memberId}/share-text`),
  upsert: (memberId: string, body: DietPlanUpsert) => apiPut<DietPlan>(`/diet-plans/member/${memberId}`, body),
  addItem: (memberId: string, body: DietPlanItemCreate) =>
    apiPost<DietPlan>(`/diet-plans/member/${memberId}/items`, body),
  removeItem: (memberId: string, itemId: string) =>
    apiDelete<DietPlan>(`/diet-plans/member/${memberId}/items/${itemId}`),
  foods: () => apiGet<Paginated<FoodItem>>("/food-items", ALL_ROWS),
};

export const dietKeys = {
  all: (branch: string | null | undefined) => ["diet", branch] as const,
  eligible: (branch: string | null | undefined, query: PageQuery) => ["diet", branch, "eligible", query] as const,
  plan: (branch: string | null | undefined, memberId: string) => ["diet", branch, "plan", memberId] as const,
  share: (branch: string | null | undefined, memberId: string) => ["diet", branch, "share", memberId] as const,
  foods: (branch: string | null | undefined) => ["food-items", branch] as const,
};
