import { apiGet, apiPost, cleanParams } from "@/lib/api-client";
import type { Paginated } from "@/types/api";
import type { PTListQuery, PTSessionLog, PTSessionLogCreate, PTSubscription, PTTrainerUpdate } from "@/types/training";

export const trainingApi = {
  list: (query: PTListQuery) => apiGet<Paginated<PTSubscription>>("/personal-training", cleanParams(query)),
  sessions: (id: string) => apiGet<PTSessionLog[]>(`/personal-training/${id}/sessions`),
  logSession: (id: string, body: PTSessionLogCreate) =>
    apiPost<PTSubscription>(`/personal-training/${id}/sessions`, body),
  changeTrainer: (id: string, body: PTTrainerUpdate) =>
    apiPost<PTSubscription>(`/personal-training/${id}/trainer`, body),
};

export const trainingKeys = {
  all: (branch: string | null | undefined) => ["personal-training", branch] as const,
  list: (branch: string | null | undefined, query: PTListQuery) =>
    ["personal-training", branch, "list", query] as const,
  sessions: (branch: string | null | undefined, id: string) =>
    ["personal-training", branch, "sessions", id] as const,
};
