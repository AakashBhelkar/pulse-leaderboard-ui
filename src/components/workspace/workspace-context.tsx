"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_PLANT, PLANTS, getPlant } from "@/lib/config/plants";
import { MODEL_IDS } from "@/lib/config/models";
import { DEFAULT_SCENARIO, SCENARIOS, type ScenarioId } from "@/lib/mock/scenarios";
import type { ModelId, PlantId } from "@/lib/types";
import type { ScopeQuery } from "@/lib/api/client";
import { MAX_RANGE_DAYS, clampDay, clampRange, isValidDay } from "@/lib/utils/date";

/**
 * Workspace selection lives in the URL so any view a stakeholder is looking at
 * can be copied straight out of the address bar and reopened exactly.
 */
interface WorkspaceState {
  plantId: PlantId;
  from: string;
  to: string;
  scenario: ScenarioId;
  /** Models toggled on in the primary chart. Metrics always cover all three. */
  visibleModels: ModelId[];
  scope: ScopeQuery;
  isSingleDay: boolean;
  setPlant: (id: PlantId) => void;
  setRange: (from: string, to: string, anchor?: "from" | "to") => void;
  /** Longest selectable period, surfaced so controls can label the limit. */
  maxRangeDays: number;
  /** True when the URL asked for a longer period than the cap allows. */
  rangeCapped: boolean;
  setScenario: (id: ScenarioId) => void;
  toggleModel: (id: ModelId) => void;
  openDay: (date: string) => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

function parseModels(raw: string | null): ModelId[] {
  if (!raw) return [...MODEL_IDS];
  const parts = raw.split(",").filter((p): p is ModelId => MODEL_IDS.includes(p as ModelId));
  return parts.length ? parts : [...MODEL_IDS];
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const plantId = (getPlant(params.get("plant") ?? "")?.id ?? DEFAULT_PLANT) as PlantId;
  const plant = PLANTS[plantId];

  // Default view is a single day — the latest day with complete data (PRD:
  // day-level comparison is the primary evidence, long ranges are secondary).
  const rawTo = params.get("to");
  const to = clampDay(
    isValidDay(rawTo) ? rawTo : plant.data_to,
    plant.data_from,
    plant.data_to,
  );
  const rawFrom = params.get("from");
  // A pasted or stale URL can carry any period; the cap is applied here so no
  // view further down ever sees an over-long range.
  const period = clampRange(
    isValidDay(rawFrom) ? rawFrom : to,
    to,
    { min: plant.data_from, max: plant.data_to },
    "to",
  );
  const from = period.from;

  /* Rewrite the address bar when a period had to be trimmed, so a link always
     describes the data it actually shows. Guarded on the values differing, so
     this runs once and never loops. */
  useEffect(() => {
    if (!period.capped) return;
    if (params.get("from") === period.from && params.get("to") === period.to) return;
    const next = new URLSearchParams(params.toString());
    next.set("from", period.from);
    next.set("to", period.to);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [period.capped, period.from, period.to, params, pathname, router]);

  /* Validated, not cast. An unrecognised `scenario` in the URL used to leave
     SCENARIOS[scenario] undefined, which threw inside the header and took the
     whole shell down — and these URLs get bookmarked and pasted around. An
     unknown value now falls back to the default instead. */
  const requestedScenario = params.get("scenario");
  const scenario: ScenarioId =
    requestedScenario && requestedScenario in SCENARIOS
      ? (requestedScenario as ScenarioId)
      : DEFAULT_SCENARIO;
  const visibleModels = parseModels(params.get("models"));

  const push = useCallback(
    (updates: Record<string, string | null>, target?: string) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(`${target ?? pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const value = useMemo<WorkspaceState>(() => {
    const scope: ScopeQuery = { plantId, from, to, scenario };
    return {
      plantId,
      from,
      to,
      scenario,
      visibleModels,
      scope,
      maxRangeDays: MAX_RANGE_DAYS,
      rangeCapped: period.capped,
      isSingleDay: from === to,
      setPlant: (id) => {
        const target = PLANTS[id];
        // Keep the period when switching plants, clamped to what that plant has.
        push({
          plant: id,
          from: clampDay(from, target.data_from, target.data_to),
          to: clampDay(to, target.data_from, target.data_to),
        });
      },
      setRange: (nextFrom, nextTo, anchor = "to") => {
        const next = clampRange(
          nextFrom,
          nextTo,
          { min: plant.data_from, max: plant.data_to },
          anchor,
        );
        push({ from: next.from, to: next.to });
      },
      setScenario: (id) => push({ scenario: id }),
      toggleModel: (id) => {
        const on = visibleModels.includes(id);
        // Never allow an empty chart.
        if (on && visibleModels.length === 1) return;
        const next = on ? visibleModels.filter((m) => m !== id) : [...visibleModels, id];
        const ordered = MODEL_IDS.filter((m) => next.includes(m));
        push({ models: ordered.length === MODEL_IDS.length ? null : ordered.join(",") });
      },
      openDay: (date) => {
        const next = new URLSearchParams(params.toString());
        next.set("plant", plantId);
        next.set("date", date);
        // Preserve the range so "back to range" returns to the same context.
        next.set("from", from);
        next.set("to", to);
        router.push(`/monitor?${next.toString()}`);
      },
    };
  }, [plantId, plant, from, to, scenario, visibleModels, period.capped, push, params, router]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

export function usePlant() {
  const { plantId } = useWorkspace();
  return PLANTS[plantId];
}
