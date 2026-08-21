/**
 * Canonical API contract.
 *
 * The mock service and the production backend MUST satisfy these types
 * (PRD §18). No component reads anything that is not declared here, so
 * swapping the mock adapter for the real API requires zero UI changes.
 */

/* -------------------------------------------------------------------------- */
/* Identity                                                                    */
/* -------------------------------------------------------------------------- */

export type ModelId = "external_qca" | "sunsure_internal" | "nevron";

export type PlantId = "erandol" | "gursarai";

export type BandCode = "A" | "B" | "C" | "D" | "E";

export interface PlantConfig {
  id: PlantId;
  name: string;
  state: string;
  state_short: string;
  capacity_mw: number;
  /**
   * Tolerance used to size the chart's fill around Actual. Equal to Band A's
   * threshold, because the fill is drawn on the Band A boundary. See
   * `lib/config/band.ts` for the one case where the two would diverge.
   */
  visual_tolerance_pct: number;
  /** Official band codes the backend classifies against for this plant. */
  official_bands: BandCode[];
  /** Upper deviation bound, as a % of the block's Actual, for each band. */
  official_band_thresholds: { band: BandCode; upto_pct: number | null }[];
  /**
   * PPA tariff, used to express deviation penalties as money. DSM as a share of
   * revenue is tariff-independent, but the rupee amounts are not.
   */
  tariff_inr_per_kwh: number;
  time_zone: string;
  commissioned: string;
  /** Earliest / latest date with evaluation data available. */
  data_from: string;
  data_to: string;
}

/* -------------------------------------------------------------------------- */
/* Intervals                                                                   */
/* -------------------------------------------------------------------------- */

/** One 15-minute evaluation block. 96 blocks = one day. */
export interface IntervalRecord {
  timestamp: string;
  block: number;
  /** null when the plant reported no Actual. Never coerced to zero (PRD §16). */
  actual_mw: number | null;
  actual_available: boolean;
  external_qca_mw: number | null;
  sunsure_internal_mw: number | null;
  nevron_mw: number | null;
  /**
   * The value actually submitted as the schedule for this block, after intraday
   * revision. Null where nothing was submitted. This — not any model's raw
   * forecast — is what real deviation settlement is measured against.
   */
  schedule_mw: number | null;
  /** Backend eligibility flag for accuracy / band metrics (PRD §16.2). */
  eligible: boolean;
  /**
   * Official band this block falls into, per model, from the same backend
   * classification that produces `ModelSummary.band_counts`. Carried per block so
   * the interval table and the band distribution can never disagree.
   * null when the block is not eligible or the model supplied no value.
   */
  bands: Record<ModelId, BandCode | null>;
}

/* -------------------------------------------------------------------------- */
/* Model metrics                                                               */
/* -------------------------------------------------------------------------- */

/**
 * How the backend derived the official band classification. The UI renders a
 * different qualification depending on this value — it never assumes.
 */
export type BandBasis = "regulatory_schedule" | "simulated_model_as_schedule";

/** How the DSM figure was derived. Drives the mandatory tooltip caveat. */
export type DsmBasis = "actual_schedule_linked" | "simulated_model_attribution";

export interface ModelSummary {
  model: ModelId;
  rmse_mw: number;
  mae_mw: number;
  bias_mw: number;
  band_a_pct: number;
  outside_band_a_pct: number;
  band_counts: Record<string, number>;
  /** Denominator behind every accuracy figure above. */
  evaluated_intervals: number;
  /** Intervals this model itself supplied a value for. */
  model_available_intervals: number;
  estimated_dsm_impact_pct: number | null;
  dsm_basis: DsmBasis | null;
  band_basis: BandBasis;
}

/** One deviation-settlement outcome, in both ratio and rupee terms. */
export interface DsmOutcome {
  /** Deviated energy priced at the band's penalty rate. */
  penalty_inr: number;
  /** Energy actually generated, priced at the PPA tariff. */
  revenue_inr: number;
  /** `penalty_inr ÷ revenue_inr × 100`. Identical to the ratio-only figure. */
  pct_of_revenue: number;
  energy_mwh: number;
}

/**
 * What deviation settlement cost, and what it would have cost under each model.
 *
 * `as_scheduled` is the baseline: the outcome of the values actually submitted.
 * `counterfactual` answers "what if this model had been the schedule instead" —
 * which is a simulation, and `basis` says so. The UI must label from `basis`
 * rather than assuming (PRD §16.3).
 */
export interface DsmComparison {
  basis: DsmBasis;
  as_scheduled: DsmOutcome | null;
  counterfactual: Partial<Record<ModelId, DsmOutcome>>;
  tariff_inr_per_kwh: number;
}

export interface CoverageInfo {
  expected_intervals: number;
  actual_available_intervals: number;
  /** Intervals eligible for accuracy/band metrics under the backend rule. */
  eligible_intervals: number;
  coverage_pct: number;
  days: number;
  /** True when models were not evaluated on an identical interval set. */
  like_for_like: boolean;
  eligibility_rule: string;
}

export type MetricKey =
  | "rmse_mw"
  | "mae_mw"
  | "bias_mw"
  | "band_a_pct"
  | "outside_band_a_pct"
  | "estimated_dsm_impact_pct";

/** Winners are resolved independently per metric. There is no overall score. */
export type MetricWinners = Partial<Record<MetricKey, ModelId | null>>;

export interface EvaluationSummary {
  plant: PlantConfig;
  range: { from: string; to: string };
  coverage: CoverageInfo;
  models: ModelSummary[];
  winners: MetricWinners;
  dsm: DsmComparison;
  generated_at: string;
  /** Marks payloads served from cache after a failed refresh (PRD §20). */
  stale: boolean;
  notes: string[];
}

/* -------------------------------------------------------------------------- */
/* Daily evidence                                                              */
/* -------------------------------------------------------------------------- */

export interface DailySummary {
  date: string;
  expected_intervals: number;
  actual_available_intervals: number;
  eligible_intervals: number;
  coverage_pct: number;
  models: {
    model: ModelId;
    rmse_mw: number;
    mae_mw: number;
    band_a_pct: number;
  }[];
  best_by_rmse: ModelId | null;
  best_by_mae: ModelId | null;
  best_by_band_a: ModelId | null;
  peak_actual_mw: number | null;
  energy_mwh: number | null;
}

export interface DailyResponse {
  plant_id: PlantId;
  range: { from: string; to: string };
  days: DailySummary[];
}

/* -------------------------------------------------------------------------- */
/* Series + day detail                                                         */
/* -------------------------------------------------------------------------- */

export interface SeriesResponse {
  plant: PlantConfig;
  range: { from: string; to: string };
  /** Resolution actually returned — the UI labels the axis accordingly. */
  resolution: "15min" | "hourly";
  intervals: IntervalRecord[];
  coverage: CoverageInfo;
}

export interface DayDetailResponse {
  plant: PlantConfig;
  date: string;
  intervals: IntervalRecord[];
  coverage: CoverageInfo;
  models: ModelSummary[];
  winners: MetricWinners;
  /**
   * Priced over this day's eligible blocks only. Present so a day-scoped view
   * can show settlement cost without falling back to the period figure, which
   * would put a month of rupees beside a single day of metrics.
   */
  dsm: DsmComparison;
}

/* -------------------------------------------------------------------------- */
/* Comparison workspace                                                        */
/* -------------------------------------------------------------------------- */

export interface CompareSelection {
  id: string;
  plant_id: PlantId;
  from: string;
  to: string;
  label?: string;
}

export interface CompareRow {
  selection: CompareSelection;
  plant: PlantConfig;
  coverage: CoverageInfo;
  models: ModelSummary[];
  winners: MetricWinners;
}

export interface CompareResponse {
  rows: CompareRow[];
  /** True when selections span plants with different regulatory structures. */
  cross_plant: boolean;
  notes: string[];
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export interface ApiErrorBody {
  error: string;
  message: string;
  retryable: boolean;
}

export class ApiError extends Error {
  status: number;
  retryable: boolean;
  constructor(message: string, status: number, retryable = true) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryable = retryable;
  }
}
