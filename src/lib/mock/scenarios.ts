import type { ModelId } from "@/lib/types";

/**
 * Demo scenarios.
 *
 * PROTOTYPE ONLY. Every scenario is a property of the mock data adapter, not of
 * the UI. When the real API is wired in, this module and the `scenario` query
 * parameter are deleted and nothing in `components/` changes.
 */
export type ScenarioId =
  | "typical"
  | "clear_sky"
  | "monsoon"
  | "sensor_gap"
  | "model_outage"
  | "qca_drift"
  | "no_data"
  | "api_error"
  | "stale";

export interface ScenarioDef {
  id: ScenarioId;
  name: string;
  summary: string;
  /** What a stakeholder should look at once this scenario is applied. */
  demonstrates: string;
  group: "conditions" | "data quality" | "system state";
  /** 0 = cloudless, 1 = heavy convective cloud. */
  cloudiness: number;
  /** Multiplier on every model's error magnitude. */
  errorScale: number;
  /** Fraction of Actual readings dropped (kept as gaps, never zeroed). */
  actualGapRate: number;
  /** Whole-block outage windows for Actual, as [startBlock, endBlock]. */
  actualOutage?: { dayOffsetMod: number; from: number; to: number };
  /** Per-model availability dropouts. */
  modelOutage?: { model: ModelId; dayOffsetMod: number; from: number; to: number };
  /** Extra bias per model, in fraction of forecast. */
  biasOverride?: Partial<Record<ModelId, number>>;
  behaviour?: "empty" | "error" | "stale";
}

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  typical: {
    id: "typical",
    name: "Typical operations",
    summary:
      "Mixed August conditions with a few cloud passes. Full telemetry, all three models reporting.",
    demonstrates: "The everyday comparison view stakeholders will see most often.",
    group: "conditions",
    cloudiness: 0.3,
    errorScale: 1,
    actualGapRate: 0,
  },
  clear_sky: {
    id: "clear_sky",
    name: "Clear sky",
    summary:
      "Cloudless days. Every model tracks the curve closely and Band A share is high across the board.",
    demonstrates:
      "How the leaderboard reads when models are nearly tied — winners are separated by small margins.",
    group: "conditions",
    cloudiness: 0.08,
    errorScale: 0.55,
    actualGapRate: 0,
  },
  monsoon: {
    id: "monsoon",
    name: "Monsoon volatility",
    summary:
      "Heavy, fast-moving cloud cover. Forecast divergence widens sharply and deviation bands degrade.",
    demonstrates:
      "The stress case: wide tolerance breaches, more Band C/D blocks, higher DSM exposure.",
    group: "conditions",
    cloudiness: 0.68,
    errorScale: 2.1,
    actualGapRate: 0,
  },
  sensor_gap: {
    id: "sensor_gap",
    name: "SCADA outage",
    summary:
      "A telemetry gap removes part of the Actual series. Coverage drops below 100% and the Actual line breaks.",
    demonstrates:
      "Missing Actual is shown as a gap and excluded from denominators — never back-filled with zero.",
    group: "data quality",
    cloudiness: 0.45,
    errorScale: 1.05,
    actualGapRate: 0,
    actualOutage: { dayOffsetMod: 3, from: 36, to: 58 },
  },
  model_outage: {
    id: "model_outage",
    name: "Model feed dropout",
    summary:
      "Nevron stops delivering forecasts for part of the period while the other two keep reporting.",
    demonstrates:
      "Per-model coverage diverges, so the comparison is flagged as not like-for-like.",
    group: "data quality",
    cloudiness: 0.44,
    errorScale: 1,
    actualGapRate: 0,
    modelOutage: { model: "nevron", dayOffsetMod: 2, from: 28, to: 72 },
  },
  qca_drift: {
    id: "qca_drift",
    name: "QCA over-forecast drift",
    summary:
      "The external QCA feed develops a strong positive bias while the other models stay centred.",
    demonstrates:
      "Bias as a distinct failure mode — visible on the chart long before RMSE alone explains it.",
    group: "conditions",
    cloudiness: 0.4,
    errorScale: 1.15,
    actualGapRate: 0,
    biasOverride: { external_qca: 0.17 },
  },
  no_data: {
    id: "no_data",
    name: "No evaluation data",
    summary: "The selected plant and period returned no records.",
    demonstrates: "The empty state and its recovery path.",
    group: "system state",
    cloudiness: 0.4,
    errorScale: 1,
    actualGapRate: 0,
    behaviour: "empty",
  },
  api_error: {
    id: "api_error",
    name: "API failure",
    summary: "The evaluation service is unreachable.",
    demonstrates: "The error state with a retry action and no stale numbers presented as current.",
    group: "system state",
    cloudiness: 0.4,
    errorScale: 1,
    actualGapRate: 0,
    behaviour: "error",
  },
  stale: {
    id: "stale",
    name: "Stale cache",
    summary:
      "The last refresh failed, so the workspace is showing the previous successful payload.",
    demonstrates: "Stale data is served but explicitly marked, never passed off as current.",
    group: "system state",
    cloudiness: 0.42,
    errorScale: 1,
    actualGapRate: 0,
    behaviour: "stale",
  },
};

export const SCENARIO_LIST = Object.values(SCENARIOS);

export const DEFAULT_SCENARIO: ScenarioId = "typical";

export function resolveScenario(id: string | null | undefined): ScenarioDef {
  if (!id) return SCENARIOS[DEFAULT_SCENARIO];
  return SCENARIOS[id as ScenarioId] ?? SCENARIOS[DEFAULT_SCENARIO];
}
