import type { DsmBasis, MetricKey } from "@/lib/types";

export type Direction = "lower" | "higher" | "zero";

export interface MetricDefinition {
  key: MetricKey | "coverage" | "visual_tolerance" | "eligible" | "band_dist";
  label: string;
  unit: string;
  direction: Direction;
  /** Plain-language meaning — no external documentation required (PRD §9). */
  plain: string;
  formula?: string;
  /** Where the number comes from — drives the authority chip in the tooltip. */
  authority: "backend" | "frontend-visual";
  caveat?: string;
}

const DIRECTION_TEXT: Record<Direction, string> = {
  lower: "Lower is better",
  higher: "Higher is better",
  zero: "Closer to zero is better",
};

export function directionText(d: Direction) {
  return DIRECTION_TEXT[d];
}

/**
 * Single source of truth for every metric explanation in the product.
 * Cards, table headers, chart legends and the metric reference dialog all read
 * from here so the wording can never drift between surfaces (PRD §11.2).
 */
export const METRIC_CATALOG: Record<string, MetricDefinition> = {
  rmse_mw: {
    key: "rmse_mw",
    label: "RMSE",
    unit: "MW",
    direction: "lower",
    plain:
      "Root Mean Square Error. The typical size of the forecast error, with larger mistakes penalised more heavily than small ones.",
    formula: "sqrt( mean( (forecast − actual)² ) )",
    authority: "backend",
  },
  mae_mw: {
    key: "mae_mw",
    label: "MAE",
    unit: "MW",
    direction: "lower",
    plain:
      "Mean Absolute Error. The average absolute gap between forecast and Actual. Every error counts linearly, so it is less sensitive to one-off spikes than RMSE.",
    formula: "mean( |forecast − actual| )",
    authority: "backend",
  },
  bias_mw: {
    key: "bias_mw",
    label: "Bias",
    unit: "MW",
    direction: "zero",
    plain:
      "Mean signed error. Positive means the model over-predicts on average; negative means it under-predicts. A model can have low bias and still be inaccurate if its errors cancel out.",
    formula: "mean( forecast − actual )",
    authority: "backend",
  },
  band_a_pct: {
    key: "band_a_pct",
    label: "Band A",
    unit: "%",
    direction: "higher",
    plain:
      "Share of eligible intervals the backend classifies into official Band A — the free band where no deviation penalty applies. A block is in Band A when the forecast is within the plant's tolerance of that block's Actual generation.",
    formula: "|forecast − actual| ÷ actual ≤ tolerance",
    authority: "backend",
    caveat:
      "Classified by the backend. The chart's tolerance envelope is drawn at this same boundary, so a forecast outside the fill is a forecast outside Band A — but the classification itself is always the backend's, never inferred from the chart.",
  },
  outside_band_a_pct: {
    key: "outside_band_a_pct",
    label: "Outside A",
    unit: "%",
    direction: "lower",
    plain:
      "Share of eligible intervals falling outside official Band A — the forecast missed that block's Actual by more than the plant's tolerance. Complement of Band A over the same denominator.",
    authority: "backend",
    caveat:
      "Denominator is the eligible interval set, not the full expected block count.",
  },
  estimated_dsm_impact_pct: {
    key: "estimated_dsm_impact_pct",
    label: "DSM impact",
    unit: "%",
    direction: "lower",
    plain:
      "Deviation-settlement penalty expressed as a share of energy revenue for the period.",
    formula: "penalty ÷ revenue",
    authority: "backend",
  },
  nrmse_pct: {
    key: "rmse_mw",
    label: "NRMSE",
    unit: "%",
    direction: "lower",
    plain:
      "Normalised RMSE. The same typical-error measure, expressed as a share of installed AC capacity so plants of different size can be compared directly.",
    formula: "RMSE ÷ plant capacity (MW) × 100",
    authority: "backend",
    caveat:
      "Derived on the client from the backend RMSE and the plant's rated capacity. Use this, not raw MW, when comparing across plants.",
  },
  nmae_pct: {
    key: "mae_mw",
    label: "NMAE",
    unit: "%",
    direction: "lower",
    plain:
      "Normalised MAE. Average absolute error as a share of installed AC capacity, so it is comparable across plants of different size.",
    formula: "MAE ÷ plant capacity (MW) × 100",
    authority: "backend",
    caveat:
      "Derived on the client from the backend MAE and the plant's rated capacity.",
  },
  bias_pct: {
    key: "bias_mw",
    label: "Bias %",
    unit: "%",
    direction: "zero",
    plain:
      "Mean signed error as a share of installed capacity. Positive means the model over-predicts on average, negative means it under-predicts.",
    formula: "bias ÷ plant capacity (MW) × 100",
    authority: "backend",
    caveat:
      "Derived on the client from the backend bias and the plant's rated capacity.",
  },
  coverage: {
    key: "coverage",
    label: "Actual coverage",
    unit: "%",
    direction: "higher",
    plain:
      "Intervals with a valid Actual reading divided by the intervals expected for the selected scope. Missing readings stay missing — they are never treated as zero generation.",
    formula: "actual intervals available ÷ expected intervals",
    authority: "backend",
  },
  eligible: {
    key: "eligible",
    label: "Eligible intervals",
    unit: "blocks",
    direction: "higher",
    plain:
      "The common interval set used as the denominator for every accuracy and band metric, so no model is scored on an easier subset of the period.",
    authority: "backend",
  },
  visual_tolerance: {
    key: "visual_tolerance",
    label: "Band A boundary",
    unit: "%",
    direction: "zero",
    plain:
      "The shaded band drawn around the Actual line. Its edge is Band A: ±10% of Actual in UP, ±15% in Maharashtra. A forecast inside the band is a block in Band A; a forecast outside it is a block outside Band A.",
    formula: "actual × (1 ± tolerance)",
    authority: "frontend-visual",
    caveat:
      "The frontend draws where the boundary lies; it never computes the classification. Every Band A percentage and band count comes from the backend. If a future backend classifies against the submitted schedule instead of the model forecast, the band and this shading stop coinciding — the payload's band_basis field says which is in play.",
  },
  band_dist: {
    key: "band_dist",
    label: "Band distribution",
    unit: "blocks",
    direction: "higher",
    plain:
      "How the eligible intervals for the whole selected range distribute across the official deviation bands for this plant. Deviation is measured against each block's Actual generation.",
    authority: "backend",
    caveat:
      "Counts aggregate every eligible interval in the range, not a single day, and are the same per-block classifications shown in the interval table.",
  },
};

/** Mandatory qualification text for the DSM figure (PRD §16.3). */
export const DSM_BASIS_TEXT: Record<DsmBasis, { label: string; text: string }> = {
  actual_schedule_linked: {
    label: "Schedule-linked",
    text: "Derived from the final scheduled values actually submitted, so it reflects settled deviation liability for the period.",
  },
  simulated_model_attribution: {
    label: "Simulated",
    text: "Hypothetical model attribution: it assumes this model's forecast had been submitted as the schedule, unchanged, for every interval. It is not settled DSM liability and no schedule revision is modelled.",
  },
};

export const BAND_BASIS_TEXT = {
  regulatory_schedule: {
    label: "Schedule-based",
    text: "Classified by the backend against the submitted schedule under the applicable state regulation.",
  },
  simulated_model_as_schedule: {
    label: "Simulated",
    text: "Classified by the backend on the assumption that this model's forecast had been the submitted schedule. Used to compare models on a like-for-like basis; it is not settled regulatory classification.",
  },
} as const;
