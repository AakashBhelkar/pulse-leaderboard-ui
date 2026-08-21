import { useQuery } from "@tanstack/react-query";
import { api, type ScopeQuery } from "./client";
import type { CompareSelection } from "@/lib/types";

/** Query keys are scope-shaped so switching plant/date/scenario refetches
 *  exactly the affected surfaces and nothing else. */
export const queryKeys = {
  plants: ["plants"] as const,
  summary: (s: ScopeQuery) => ["summary", s.plantId, s.from, s.to, s.scenario] as const,
  daily: (s: ScopeQuery) => ["daily", s.plantId, s.from, s.to, s.scenario] as const,
  series: (s: ScopeQuery) => ["series", s.plantId, s.from, s.to, s.scenario] as const,
  day: (s: ScopeQuery, d: string) => ["day", s.plantId, d, s.scenario] as const,
  compare: (sel: CompareSelection[], scenario: string) =>
    ["compare", scenario, sel.map((x) => `${x.plant_id}:${x.from}:${x.to}`).join("|")] as const,
};

export function useSummary(scope: ScopeQuery) {
  return useQuery({ queryKey: queryKeys.summary(scope), queryFn: () => api.summary(scope) });
}

export function useDaily(scope: ScopeQuery) {
  return useQuery({ queryKey: queryKeys.daily(scope), queryFn: () => api.daily(scope) });
}

export function useSeries(scope: ScopeQuery) {
  return useQuery({ queryKey: queryKeys.series(scope), queryFn: () => api.series(scope) });
}

export function useDayDetail(scope: ScopeQuery, date: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.day(scope, date),
    queryFn: () => api.day(scope, date),
    enabled: enabled && Boolean(date),
  });
}

export function useComparison(selections: CompareSelection[], scenario: string) {
  return useQuery({
    queryKey: queryKeys.compare(selections, scenario),
    queryFn: () => api.compare(selections, scenario),
    enabled: selections.length > 0,
  });
}
