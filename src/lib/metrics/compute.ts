import { MODEL_FIELD, MODEL_IDS } from "@/lib/config/models";
import type {
  BandCode,
  DsmBasis,
  DsmComparison,
  DsmOutcome,
  CoverageInfo,
  DailySummary,
  IntervalRecord,
  MetricKey,
  MetricWinners,
  ModelId,
  ModelSummary,
  PlantConfig,
} from "@/lib/types";
import { BLOCKS_PER_DAY } from "@/lib/utils/date";
import { ELIGIBILITY_RULE } from "@/lib/mock/generate";
import { round } from "@/lib/mock/rng";

/* -------------------------------------------------------------------------- */
/* Official band classification                                                */
/* -------------------------------------------------------------------------- */

/**
 * Deviation is expressed as a percentage of ACTUAL generation for that block.
 * A forecast that lands more than the plant's band-A tolerance away from Actual
 * is outside Band A — the same measurement the chart's envelope draws, so the
 * two can never tell different stories.
 *
 * Actual can legitimately be at or near zero inside the eligible window (a cloud
 * bank over a high clear-sky block), and a ratio against zero has no meaning.
 * The rule below is explicit rather than implied:
 *   · Actual and forecast both effectively zero → 0% deviation.
 *   · Actual effectively zero, forecast not     → unbounded, i.e. the worst band.
 * ZERO_MW is well under one block's metering resolution, so it only ever catches
 * true zeros, never a small genuine reading.
 */
const ZERO_MW = 0.001;

export function deviationPct(actual: number, forecast: number): number {
  const error = Math.abs(forecast - actual);
  if (actual <= ZERO_MW) return error <= ZERO_MW ? 0 : Number.POSITIVE_INFINITY;
  return (error / actual) * 100;
}

export function classifyBand(devPct: number, plant: PlantConfig): BandCode {
  for (const t of plant.official_band_thresholds) {
    if (t.upto_pct === null || devPct <= t.upto_pct) return t.band;
  }
  return plant.official_band_thresholds[plant.official_band_thresholds.length - 1].band;
}

/** Penalty rate applied to deviated energy, by band. Band A is the free band. */
const BAND_PENALTY_RATE: Record<BandCode, number> = {
  A: 0,
  B: 0.1,
  C: 0.18,
  D: 0.26,
  E: 0.34,
};

/**
 * THE single official-band classification pass.
 *
 * Every band figure in the product — the distribution chart, the leaderboard's
 * Band A %, and the per-block letter in the interval table — is read from the
 * `bands` written here. Nothing classifies a block a second time, so the chart
 * and the table cannot drift apart.
 */
export function annotateBands(
  intervals: IntervalRecord[],
  plant: PlantConfig,
): IntervalRecord[] {
  return intervals.map((row) => {
    const bands: Record<ModelId, BandCode | null> = {
      external_qca: null,
      sunsure_internal: null,
      nevron: null,
    };
    if (row.eligible && row.actual_mw !== null) {
      for (const id of MODEL_IDS) {
        const forecast = row[MODEL_FIELD[id]];
        if (forecast === null) continue;
        bands[id] = classifyBand(deviationPct(row.actual_mw, forecast), plant);
      }
    }
    return { ...row, bands };
  });
}

/* -------------------------------------------------------------------------- */
/* Eligible interval set                                                       */
/* -------------------------------------------------------------------------- */

export interface EligibilityResult {
  /** Blocks usable by every model — the like-for-like comparison set. */
  common: IntervalRecord[];
  /** Blocks usable per model, before intersection. */
  perModel: Record<ModelId, number>;
  likeForLike: boolean;
}

/**
 * Build the common evaluation set (PRD §16.1). A block only enters the
 * denominator when the Actual is valid AND every model supplied a value, so no
 * model is scored on an easier subset of the period.
 */
export function resolveEligibility(intervals: IntervalRecord[]): EligibilityResult {
  const perModel: Record<ModelId, number> = {
    external_qca: 0,
    sunsure_internal: 0,
    nevron: 0,
  };
  const common: IntervalRecord[] = [];

  for (const row of intervals) {
    if (!row.eligible || row.actual_mw === null) continue;
    let all = true;
    for (const id of MODEL_IDS) {
      if (row[MODEL_FIELD[id]] === null) all = false;
      else perModel[id] += 1;
    }
    if (all) common.push(row);
  }

  const counts = MODEL_IDS.map((id) => perModel[id]);
  const likeForLike = counts.every((c) => c === common.length);
  return { common, perModel, likeForLike };
}

/* -------------------------------------------------------------------------- */
/* Model summary                                                               */
/* -------------------------------------------------------------------------- */

export function summariseModel(
  model: ModelId,
  common: IntervalRecord[],
  perModelAvailable: number,
  plant: PlantConfig,
): ModelSummary {
  const field = MODEL_FIELD[model];
  const bandCounts: Record<string, number> = {};
  for (const b of plant.official_bands) bandCounts[b] = 0;

  let sqSum = 0;
  let absSum = 0;
  let signedSum = 0;
  let n = 0;
  let bandA = 0;
  let penaltyMwh = 0;
  let revenueMwh = 0;

  for (const row of common) {
    const f = row[field];
    const a = row.actual_mw;
    if (f === null || a === null) continue;
    const err = f - a;
    sqSum += err * err;
    absSum += Math.abs(err);
    signedSum += err;
    n += 1;

    // Read, never re-derive: `annotateBands` is the only classifier.
    const band =
      row.bands?.[model] ??
      classifyBand(deviationPct(a, f), plant);
    bandCounts[band] = (bandCounts[band] ?? 0) + 1;
    if (band === "A") bandA += 1;

    // Quarter-hour blocks: MW → MWh.
    penaltyMwh += Math.abs(err) * 0.25 * BAND_PENALTY_RATE[band];
    revenueMwh += a * 0.25;
  }

  const bandAPct = n > 0 ? (bandA / n) * 100 : 0;
  const dsm = revenueMwh > 0 ? (penaltyMwh / revenueMwh) * 100 : null;

  return {
    model,
    rmse_mw: n > 0 ? round(Math.sqrt(sqSum / n), 3) : 0,
    mae_mw: n > 0 ? round(absSum / n, 3) : 0,
    bias_mw: n > 0 ? round(signedSum / n, 3) : 0,
    band_a_pct: round(bandAPct, 1),
    outside_band_a_pct: round(100 - bandAPct, 1),
    band_counts: bandCounts,
    evaluated_intervals: n,
    model_available_intervals: perModelAvailable,
    estimated_dsm_impact_pct: dsm === null ? null : round(dsm, 2),
    // The mock backend can only attribute deviation to a model by assuming the
    // forecast had been submitted as the schedule. That assumption is carried in
    // the payload so the UI can state it rather than infer it.
    dsm_basis: "simulated_model_attribution",
    band_basis: "simulated_model_as_schedule",
  };
}

/* -------------------------------------------------------------------------- */
/* Deviation settlement, priced                                                */
/* -------------------------------------------------------------------------- */

/**
 * Price the deviation of one submitted series against Actual.
 *
 * Used for the schedule that was actually submitted and for each model's
 * counterfactual, so the baseline and the alternatives are always measured the
 * same way. `pct_of_revenue` is tariff-independent and equals the ratio-only
 * figure already on `ModelSummary.estimated_dsm_impact_pct`.
 */
export function priceDeviation(
  intervals: IntervalRecord[],
  pick: (row: IntervalRecord) => number | null,
  plant: PlantConfig,
): DsmOutcome | null {
  let penaltyMwh = 0;
  let energyMwh = 0;
  let counted = 0;

  for (const row of intervals) {
    const submitted = pick(row);
    const a = row.actual_mw;
    if (submitted === null || a === null) continue;
    const band = classifyBand(deviationPct(a, submitted), plant);
    // Quarter-hour blocks: MW → MWh.
    penaltyMwh += Math.abs(submitted - a) * 0.25 * BAND_PENALTY_RATE[band];
    energyMwh += a * 0.25;
    counted += 1;
  }

  if (counted === 0 || energyMwh <= 0) return null;

  const perMwh = plant.tariff_inr_per_kwh * 1000;
  const penalty_inr = penaltyMwh * perMwh;
  const revenue_inr = energyMwh * perMwh;

  return {
    penalty_inr: round(penalty_inr, 0),
    revenue_inr: round(revenue_inr, 0),
    pct_of_revenue: round((penalty_inr / revenue_inr) * 100, 2),
    energy_mwh: round(energyMwh, 1),
  };
}

/**
 * The settlement picture for one plant-period: what the submitted schedule cost,
 * and what each model would have cost in its place.
 *
 * `basis` is carried so the UI states what these numbers are rather than
 * assuming. While the schedule is generated by the mock the basis stays
 * simulated; a backend supplying real submitted values flips it.
 */
export function compareDsm(
  intervals: IntervalRecord[],
  plant: PlantConfig,
  basis: DsmBasis = "simulated_model_attribution",
): DsmComparison {
  const counterfactual: Partial<Record<ModelId, DsmOutcome>> = {};
  for (const id of MODEL_IDS) {
    const outcome = priceDeviation(intervals, (row) => row[MODEL_FIELD[id]], plant);
    if (outcome) counterfactual[id] = outcome;
  }
  return {
    basis,
    as_scheduled: priceDeviation(intervals, (row) => row.schedule_mw, plant),
    counterfactual,
    tariff_inr_per_kwh: plant.tariff_inr_per_kwh,
  };
}

/* -------------------------------------------------------------------------- */
/* Coverage                                                                    */
/* -------------------------------------------------------------------------- */

export function computeCoverage(
  intervals: IntervalRecord[],
  days: number,
  eligibility: EligibilityResult,
): CoverageInfo {
  const expected = days * BLOCKS_PER_DAY;
  const available = intervals.filter((r) => r.actual_available && r.actual_mw !== null).length;
  return {
    expected_intervals: expected,
    actual_available_intervals: available,
    eligible_intervals: eligibility.common.length,
    coverage_pct: expected > 0 ? round((available / expected) * 100, 1) : 0,
    days,
    like_for_like: eligibility.likeForLike,
    eligibility_rule: ELIGIBILITY_RULE,
  };
}

/* -------------------------------------------------------------------------- */
/* Winners — resolved independently, never combined                            */
/* -------------------------------------------------------------------------- */

const METRIC_DIRECTION: Record<MetricKey, "lower" | "higher" | "zero"> = {
  rmse_mw: "lower",
  mae_mw: "lower",
  bias_mw: "zero",
  band_a_pct: "higher",
  outside_band_a_pct: "lower",
  estimated_dsm_impact_pct: "lower",
};

export function pickWinner(models: ModelSummary[], metric: MetricKey): ModelId | null {
  const dir = METRIC_DIRECTION[metric];
  let best: ModelSummary | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const m of models) {
    const raw = m[metric];
    if (raw === null || raw === undefined) continue;
    if (m.evaluated_intervals === 0) continue;
    const score = dir === "higher" ? -raw : dir === "zero" ? Math.abs(raw) : raw;
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best?.model ?? null;
}

/**
 * There is deliberately no composite score here. A model may legitimately win
 * different metrics; collapsing that into one number is a separate, approved
 * product decision (PRD §8, acceptance criterion 6).
 */
export function resolveWinners(models: ModelSummary[]): MetricWinners {
  return {
    rmse_mw: pickWinner(models, "rmse_mw"),
    mae_mw: pickWinner(models, "mae_mw"),
    bias_mw: pickWinner(models, "bias_mw"),
    band_a_pct: pickWinner(models, "band_a_pct"),
    outside_band_a_pct: pickWinner(models, "outside_band_a_pct"),
    estimated_dsm_impact_pct: pickWinner(models, "estimated_dsm_impact_pct"),
  };
}

/* -------------------------------------------------------------------------- */
/* Daily rollup                                                                */
/* -------------------------------------------------------------------------- */

export function summariseDay(
  date: string,
  intervals: IntervalRecord[],
  plant: PlantConfig,
): DailySummary {
  const eligibility = resolveEligibility(intervals);
  const models = MODEL_IDS.map((id) =>
    summariseModel(id, eligibility.common, eligibility.perModel[id], plant),
  );

  const actuals = intervals
    .map((r) => r.actual_mw)
    .filter((v): v is number => v !== null);
  const available = intervals.filter((r) => r.actual_available && r.actual_mw !== null).length;

  return {
    date,
    expected_intervals: BLOCKS_PER_DAY,
    actual_available_intervals: available,
    eligible_intervals: eligibility.common.length,
    coverage_pct: round((available / BLOCKS_PER_DAY) * 100, 1),
    models: models.map((m) => ({
      model: m.model,
      rmse_mw: m.rmse_mw,
      mae_mw: m.mae_mw,
      band_a_pct: m.band_a_pct,
    })),
    best_by_rmse: pickWinner(models, "rmse_mw"),
    best_by_mae: pickWinner(models, "mae_mw"),
    best_by_band_a: pickWinner(models, "band_a_pct"),
    peak_actual_mw: actuals.length ? round(Math.max(...actuals), 2) : null,
    energy_mwh: actuals.length ? round(actuals.reduce((s, v) => s + v * 0.25, 0), 1) : null,
  };
}
