import {
  ApiError,
  type ApiErrorBody,
  type CompareResponse,
  type CompareSelection,
  type DailyResponse,
  type DayDetailResponse,
  type EvaluationSummary,
  type PlantConfig,
  type SeriesResponse,
} from "@/lib/types";

/**
 * Typed service layer. Components never call `fetch` directly, so pointing the
 * app at the production backend is a matter of changing `BASE` and deleting the
 * `scenario` parameter (PRD §18).
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Could not reach the evaluation service.", 0, true);
  }

  if (!response.ok) {
    let body: Partial<ApiErrorBody> = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(
      body.message ?? `Request failed (${response.status}).`,
      response.status,
      body.retryable ?? response.status >= 500,
    );
  }

  return (await response.json()) as T;
}

export interface ScopeQuery {
  plantId: string;
  from: string;
  to: string;
  scenario: string;
}

function scopeSearch(scope: ScopeQuery, extra?: Record<string, string>) {
  const params = new URLSearchParams({
    plant_id: scope.plantId,
    from: scope.from,
    to: scope.to,
    scenario: scope.scenario,
    ...extra,
  });
  return params.toString();
}

export const api = {
  plants: () => request<{ plants: PlantConfig[] }>("/plants"),

  summary: (scope: ScopeQuery) =>
    request<EvaluationSummary>(`/evaluation/summary?${scopeSearch(scope)}`),

  daily: (scope: ScopeQuery) =>
    request<DailyResponse>(`/evaluation/daily?${scopeSearch(scope)}`),

  series: (scope: ScopeQuery) =>
    request<SeriesResponse>(`/evaluation/series?${scopeSearch(scope)}`),

  day: (scope: ScopeQuery, date: string) =>
    request<DayDetailResponse>(`/evaluation/day?${scopeSearch(scope, { date })}`),

  compare: (selections: CompareSelection[], scenario: string) =>
    request<CompareResponse>("/evaluation/compare", {
      method: "POST",
      body: JSON.stringify({ selections, scenario }),
    }),

  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
};
