import type { ModelSummary, PlantConfig } from "@/lib/types";

/**
 * Capacity-normalised metrics.
 *
 * A 20 MW plant will always post a larger absolute RMSE than a 12 MW plant for
 * the same forecasting quality, so raw MW figures cannot be compared across
 * plants. Dividing by installed AC capacity puts every selection on one scale.
 *
 * These are derived on the client from fields the backend already returns —
 * `rmse_mw`, `mae_mw`, `bias_mw` and the plant's `capacity_mw`. Nothing new is
 * required from the API. If the backend later returns them directly, delete
 * this module and read the fields instead.
 */

export type NormalizedKey = "nrmse_pct" | "nmae_pct" | "bias_pct";

export type ComparisonMetricKey =
  | NormalizedKey
  | "rmse_mw"
  | "mae_mw"
  | "band_a_pct"
  | "outside_band_a_pct"
  | "estimated_dsm_impact_pct";

export interface NormalizedModel {
  nrmse_pct: number;
  nmae_pct: number;
  bias_pct: number;
}

/**
 * Full precision, deliberately.
 *
 * These values are compared before they are displayed — they decide winners on
 * the comparison workspace and the fleet scoreboard. Rounding here made
 * 3.267% and 3.300% both read as 3.3, so the winner fell to array order and
 * could contradict the RMSE winner for the very same plant. Rounding belongs at
 * the render edge, in `formatComparisonValue`, and nowhere earlier.
 */
export function normalizeModel(model: ModelSummary, plant: PlantConfig): NormalizedModel {
  const capacity = plant.capacity_mw || 1;
  const pct = (v: number) => (v / capacity) * 100;
  return {
    nrmse_pct: pct(model.rmse_mw),
    nmae_pct: pct(model.mae_mw),
    bias_pct: pct(model.bias_mw),
  };
}

/** Reads any comparison metric off a model, deriving the normalised ones. */
export function comparisonValue(
  model: ModelSummary,
  plant: PlantConfig,
  key: ComparisonMetricKey,
): number | null {
  if (key === "nrmse_pct" || key === "nmae_pct" || key === "bias_pct") {
    return normalizeModel(model, plant)[key];
  }
  return model[key] as number | null;
}

const DIRECTION: Record<ComparisonMetricKey, "lower" | "higher" | "zero"> = {
  nrmse_pct: "lower",
  nmae_pct: "lower",
  bias_pct: "zero",
  rmse_mw: "lower",
  mae_mw: "lower",
  band_a_pct: "higher",
  outside_band_a_pct: "lower",
  estimated_dsm_impact_pct: "lower",
};

export function comparisonDirection(key: ComparisonMetricKey) {
  return DIRECTION[key];
}

/** True when the metric is comparable across plants of different capacity. */
export function isCrossPlantComparable(key: ComparisonMetricKey): boolean {
  return key === "nrmse_pct" || key === "nmae_pct" || key === "bias_pct";
}

export function formatComparisonValue(
  key: ComparisonMetricKey,
  value: number | null,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  switch (key) {
    case "rmse_mw":
    case "mae_mw":
      return value.toFixed(3);
    case "bias_pct":
      return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
    case "estimated_dsm_impact_pct":
      return `${value.toFixed(2)}%`;
    default:
      return `${value.toFixed(1)}%`;
  }
}

export const COMPARISON_METRICS: {
  key: ComparisonMetricKey;
  label: string;
  catalogKey: string;
}[] = [
  { key: "nrmse_pct", label: "NRMSE", catalogKey: "nrmse_pct" },
  { key: "rmse_mw", label: "RMSE", catalogKey: "rmse_mw" },
  { key: "nmae_pct", label: "NMAE", catalogKey: "nmae_pct" },
  { key: "mae_mw", label: "MAE", catalogKey: "mae_mw" },
  { key: "bias_pct", label: "Bias %", catalogKey: "bias_pct" },
  { key: "band_a_pct", label: "Band A", catalogKey: "band_a_pct" },
  { key: "outside_band_a_pct", label: "Outside A", catalogKey: "outside_band_a_pct" },
  {
    key: "estimated_dsm_impact_pct",
    label: "Simulated DSM",
    catalogKey: "estimated_dsm_impact_pct",
  },
];
