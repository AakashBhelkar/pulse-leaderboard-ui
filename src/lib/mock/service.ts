import { getPlant, PLANT_LIST } from "@/lib/config/plants";
import { MODEL_IDS } from "@/lib/config/models";
import {
  annotateBands,
  compareDsm,
  computeCoverage,
  resolveEligibility,
  resolveWinners,
  summariseDay,
  summariseModel,
} from "@/lib/metrics/compute";
import type {
  CompareResponse,
  CompareRow,
  CompareSelection,
  DailyResponse,
  DayDetailResponse,
  EvaluationSummary,
  IntervalRecord,
  PlantConfig,
  SeriesResponse,
} from "@/lib/types";
import { clampDay, clampRange, eachDay } from "@/lib/utils/date";
import { generateDay } from "./generate";
import { resolveScenario, type ScenarioDef } from "./scenarios";

/**
 * Mock implementation of the evaluation service.
 *
 * This module is the ONLY place that knows the data is synthetic. Every route
 * returns the contract declared in `lib/types.ts`, so swapping this for the real
 * backend is a one-file change.
 */

export class MockEmptyError extends Error {}
export class MockFailureError extends Error {}

export interface Scope {
  plant: PlantConfig;
  from: string;
  to: string;
  scenario: ScenarioDef;
}

export function resolveScope(params: {
  plantId?: string | null;
  from?: string | null;
  to?: string | null;
  scenario?: string | null;
}): Scope {
  const plant = getPlant(params.plantId ?? "") ?? PLANT_LIST[0];
  const scenario = resolveScenario(params.scenario);
  // The cap is enforced server-side as well: a hand-built request cannot ask
  // for more than the UI can render.
  const period = clampRange(
    params.from || params.to || plant.data_to,
    params.to || plant.data_to,
    { min: plant.data_from, max: plant.data_to },
    "to",
  );
  return { plant, from: period.from, to: period.to, scenario };
}

/** Applies the scenario's system-state behaviour before any data is built. */
export function assertScenarioHealth(scenario: ScenarioDef) {
  if (scenario.behaviour === "error") {
    throw new MockFailureError("Evaluation service did not respond.");
  }
  if (scenario.behaviour === "empty") {
    throw new MockEmptyError("No evaluation records for this plant and period.");
  }
}

function buildIntervals(scope: Scope): { intervals: IntervalRecord[]; days: string[] } {
  const days = eachDay(scope.from, scope.to);
  const intervals: IntervalRecord[] = [];
  for (const day of days) intervals.push(...buildDay(scope, day));
  return { intervals, days };
}

/** Generate one plant-day and stamp the official band on every block. */
function buildDay(scope: Scope, day: string): IntervalRecord[] {
  return annotateBands(generateDay(scope.plant, day, scope.scenario), scope.plant);
}

/* -------------------------------------------------------------------------- */
/* GET /evaluation/summary                                                     */
/* -------------------------------------------------------------------------- */

export function getSummary(scope: Scope): EvaluationSummary {
  assertScenarioHealth(scope.scenario);
  const { intervals, days } = buildIntervals(scope);
  const eligibility = resolveEligibility(intervals);
  const coverage = computeCoverage(intervals, days.length, eligibility);
  const models = MODEL_IDS.map((id) =>
    summariseModel(id, eligibility.common, eligibility.perModel[id], scope.plant),
  );

  const notes: string[] = [];
  if (!coverage.like_for_like) {
    notes.push(
      "Model feeds do not cover an identical interval set. Metrics use the common eligible set only; per-model availability is shown in the leaderboard.",
    );
  }
  if (coverage.coverage_pct < 99.5) {
    notes.push(
      `Actual telemetry is incomplete for this period: ${coverage.actual_available_intervals.toLocaleString()} of ${coverage.expected_intervals.toLocaleString()} expected blocks. Missing readings are excluded, never treated as zero generation.`,
    );
  }

  return {
    plant: scope.plant,
    range: { from: scope.from, to: scope.to },
    coverage,
    models,
    winners: resolveWinners(models),
    // Priced over the same common eligible set the metrics use, so the money
    // figures and the percentages can never describe different blocks.
    dsm: compareDsm(eligibility.common, scope.plant),
    generated_at: `${scope.plant.data_to}T23:45:00+05:30`,
    stale: scope.scenario.behaviour === "stale",
    notes,
  };
}

/* -------------------------------------------------------------------------- */
/* GET /evaluation/daily                                                       */
/* -------------------------------------------------------------------------- */

export function getDaily(scope: Scope): DailyResponse {
  assertScenarioHealth(scope.scenario);
  const days = eachDay(scope.from, scope.to);
  return {
    plant_id: scope.plant.id,
    range: { from: scope.from, to: scope.to },
    days: days.map((day) => summariseDay(day, buildDay(scope, day), scope.plant)),
  };
}

/* -------------------------------------------------------------------------- */
/* GET /evaluation/series                                                      */
/* -------------------------------------------------------------------------- */

export function getSeries(scope: Scope): SeriesResponse {
  assertScenarioHealth(scope.scenario);
  const { intervals, days } = buildIntervals(scope);
  const eligibility = resolveEligibility(intervals);
  // Always full resolution. A 30-day period is 2,880 blocks, which the chart
  // renders via LTTB sampling and a zoom slider — averaging would have hidden
  // exactly the 15-minute excursions that decide a block's band.
  return {
    plant: scope.plant,
    range: { from: scope.from, to: scope.to },
    resolution: "15min",
    intervals,
    coverage: computeCoverage(intervals, days.length, eligibility),
  };
}

/* -------------------------------------------------------------------------- */
/* GET /evaluation/day                                                         */
/* -------------------------------------------------------------------------- */

export function getDayDetail(scope: Scope, date: string): DayDetailResponse {
  assertScenarioHealth(scope.scenario);
  const day = clampDay(date, scope.plant.data_from, scope.plant.data_to);
  const intervals = buildDay(scope, day);
  const eligibility = resolveEligibility(intervals);
  const models = MODEL_IDS.map((id) =>
    summariseModel(id, eligibility.common, eligibility.perModel[id], scope.plant),
  );
  return {
    plant: scope.plant,
    date: day,
    intervals,
    coverage: computeCoverage(intervals, 1, eligibility),
    models,
    winners: resolveWinners(models),
    // The same common eligible set this day's metrics were computed over.
    dsm: compareDsm(eligibility.common, scope.plant),
  };
}

/* -------------------------------------------------------------------------- */
/* POST /evaluation/compare                                                    */
/* -------------------------------------------------------------------------- */

export function getComparison(
  selections: CompareSelection[],
  scenarioId: string | null,
): CompareResponse {
  const scenario = resolveScenario(scenarioId);
  assertScenarioHealth(scenario);

  const rows: CompareRow[] = selections.map((selection) => {
    const scope = resolveScope({
      plantId: selection.plant_id,
      from: selection.from,
      to: selection.to,
      scenario: scenarioId,
    });
    const { intervals, days } = buildIntervals(scope);
    const eligibility = resolveEligibility(intervals);
    const models = MODEL_IDS.map((id) =>
      summariseModel(id, eligibility.common, eligibility.perModel[id], scope.plant),
    );
    return {
      selection: { ...selection, from: scope.from, to: scope.to },
      plant: scope.plant,
      coverage: computeCoverage(intervals, days.length, eligibility),
      models,
      winners: resolveWinners(models),
    };
  });

  const plants = new Set(rows.map((r) => r.plant.id));
  const crossPlant = plants.size > 1;

  const notes: string[] = [];
  if (crossPlant) {
    notes.push(
      "Selections span plants in different states. Band and DSM metrics are state-specific — official band structures and tolerance configurations differ, so they are not directly comparable across rows. Cross-plant accuracy comparisons use capacity-normalised metrics (NRMSE, NMAE, Bias %) where applicable.",
    );
  }
  const lengths = new Set(rows.map((r) => r.coverage.days));
  if (lengths.size > 1) {
    notes.push(
      "Selections cover different numbers of days, so they rest on very different sample sizes. Error metrics are period averages and remain comparable in kind, but a selection built on a handful of intervals carries far less weight — the eligible interval count is shown against every selection.",
    );
  }
  if (rows.some((r) => !r.coverage.like_for_like)) {
    notes.push(
      "At least one selection has uneven model availability. Those rows are not a like-for-like model comparison.",
    );
  }

  return { rows, cross_plant: crossPlant, notes };
}

