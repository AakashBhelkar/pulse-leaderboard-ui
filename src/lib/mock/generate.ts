import type { IntervalRecord, ModelId, PlantConfig } from "@/lib/types";
import { MODEL_IDS } from "@/lib/config/models";
import { BLOCKS_PER_DAY, blockTimestamp, dayToUtc } from "@/lib/utils/date";
import { clamp, hashSeed, makeRand, round, type Rand } from "./rng";
import type { ScenarioDef } from "./scenarios";

/* -------------------------------------------------------------------------- */
/* Clear-sky envelope                                                          */
/* -------------------------------------------------------------------------- */

/** Sunrise / sunset block indices for a given day of year at ~22°N. */
function solarWindow(dayOfYear: number) {
  // Declination-driven day length, compressed to the IST civil clock.
  const decl = 23.45 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
  const halfDay = 6.2 + decl * 0.035; // hours either side of solar noon
  const noon = 12.35; // solar noon in IST for the northern/central plants
  return { sunrise: (noon - halfDay) * 4, sunset: (noon + halfDay) * 4, noonBlock: noon * 4 };
}

/** Theoretical clear-sky output in MW for one block. */
function clearSky(block: number, capacity: number, dayOfYear: number): number {
  const { sunrise, sunset } = solarWindow(dayOfYear);
  if (block <= sunrise || block >= sunset) return 0;
  const phase = (block - sunrise) / (sunset - sunrise);
  const base = Math.sin(Math.PI * phase);
  // Real arrays plateau a little rather than tracing a pure sine.
  const shaped = Math.pow(base, 0.86);
  // Mild seasonal derate: peak irradiance is lower in the monsoon months.
  const seasonal = 0.9 + 0.1 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear - 100));
  return capacity * 0.93 * shaped * seasonal;
}

/* -------------------------------------------------------------------------- */
/* Cloud field                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A smooth transmittance series in (0, 1]. Built from slow harmonics plus a few
 * discrete cloud passes, which is what makes forecast divergence look real:
 * models mostly agree on the envelope and disagree on the passes.
 */
function cloudField(rand: Rand, cloudiness: number): number[] {
  const n = BLOCKS_PER_DAY;
  const out = new Array<number>(n).fill(1);

  // Slow background variation.
  const harmonics = [
    { period: rand.range(70, 110), amp: rand.range(0.03, 0.1), phase: rand.range(0, 6.283) },
    { period: rand.range(26, 46), amp: rand.range(0.02, 0.07), phase: rand.range(0, 6.283) },
    { period: rand.range(11, 20), amp: rand.range(0.01, 0.04), phase: rand.range(0, 6.283) },
  ];

  for (let i = 0; i < n; i++) {
    let v = 1;
    for (const h of harmonics) {
      v -= h.amp * cloudiness * 2.2 * (0.5 + 0.5 * Math.sin((2 * Math.PI * i) / h.period + h.phase));
    }
    out[i] = v;
  }

  // Discrete cloud passes — the source of the sharp dips operators recognise.
  const passCount = Math.round(rand.range(0, 3.5) + cloudiness * 7);
  for (let p = 0; p < passCount; p++) {
    const centre = rand.int(20, 84);
    const width = rand.range(1.6, 5 + cloudiness * 9);
    const depth = clamp(rand.range(0.12, 0.35 + cloudiness * 0.62), 0, 0.9);
    for (let i = 0; i < n; i++) {
      const d = (i - centre) / width;
      out[i] -= depth * Math.exp(-d * d);
    }
  }

  for (let i = 0; i < n; i++) out[i] = clamp(out[i], 0.08, 1);
  return out;
}

/* -------------------------------------------------------------------------- */
/* Model behaviour profiles                                                    */
/* -------------------------------------------------------------------------- */

interface ModelProfile {
  /** How much of the true cloud field the model anticipated (0–1). */
  skill: number;
  /** Systematic multiplicative bias. */
  bias: number;
  /** Random noise as a fraction of capacity. */
  noise: number;
  /** Lag-1 autocorrelation of the residual: how long an error persists. */
  persistence: number;
  /** Multi-block excursions per day, as a fraction of the 96 blocks. */
  spikeRate: number;
  /** Excursion amplitude, in residual standard deviations. */
  spikeSize: number;
  /** Extra error in the volatile ramp hours (morning / evening). */
  rampWeakness: number;
  /** How far above clear-sky potential this feed is willing to forecast. */
  ceiling: number;
}

/**
 * Calibrated so the three models separate the way the pilot actually behaves:
 * Sunsure Internal wins the averaged error metrics, Nevron is tightest block to
 * block (so it takes Band A) but occasionally misses hard, and the external QCA
 * feed trails on every metric with a persistent over-forecast lean.
 */
const PROFILES: Record<ModelId, ModelProfile> = {
  external_qca: {
    skill: 0.895,
    bias: 0.028,
    noise: 0.062,
    persistence: 0.9,
    spikeRate: 0.03,
    spikeSize: 6.5,
    rampWeakness: 1.15,
    ceiling: 1.12,
  },
  sunsure_internal: {
    skill: 0.95,
    bias: 0.004,
    noise: 0.036,
    persistence: 0.93,
    spikeRate: 0.013,
    spikeSize: 7,
    rampWeakness: 1.05,
    ceiling: 1.04,
  },
  nevron: {
    skill: 0.962,
    bias: -0.007,
    noise: 0.025,
    persistence: 0.95,
    spikeRate: 0.014,
    spikeSize: 13,
    rampWeakness: 1.08,
    ceiling: 1.07,
  },
};

/* -------------------------------------------------------------------------- */
/* Day generation                                                              */
/* -------------------------------------------------------------------------- */

function dayOfYear(day: string): number {
  const ms = dayToUtc(day);
  const start = Date.UTC(new Date(ms).getUTCFullYear(), 0, 0);
  return Math.floor((ms - start) / 86400000);
}

/** Eligibility rule applied by the mock "backend" (PRD §16.2). */
export const ELIGIBILITY_RULE =
  "Daylight intervals only — blocks whose clear-sky potential exceeds 2% of plant capacity, with a valid Actual reading.";

/**
 * Generate the 96 evaluation blocks for one plant-day.
 * Deterministic in (plant, date, scenario): the same scope always returns the
 * same numbers, so demos and screenshots stay stable.
 */
export function generateDay(
  plant: PlantConfig,
  day: string,
  scenario: ScenarioDef,
): IntervalRecord[] {
  const doy = dayOfYear(day);
  const rand = makeRand(hashSeed(plant.id, day, scenario.id));

  // Each day gets its own weather character, drifting around the scenario mean.
  const dayCloudiness = clamp(
    scenario.cloudiness * rand.range(0.55, 1.45) + rand.range(-0.05, 0.05),
    0.02,
    1,
  );

  const truth = cloudField(rand, dayCloudiness);
  // Each model carries an independent view of the same weather; blending truth
  // with that view by `skill` reproduces realistic partial agreement.
  const beliefs: Record<ModelId, number[]> = {
    external_qca: cloudField(makeRand(hashSeed(plant.id, day, scenario.id, "qca")), dayCloudiness),
    sunsure_internal: cloudField(makeRand(hashSeed(plant.id, day, scenario.id, "sun")), dayCloudiness),
    nevron: cloudField(makeRand(hashSeed(plant.id, day, scenario.id, "nev")), dayCloudiness),
  };

  const dayIndex = Math.floor(dayToUtc(day) / 86400000);
  const actualOutage =
    scenario.actualOutage && dayIndex % 4 === scenario.actualOutage.dayOffsetMod
      ? scenario.actualOutage
      : null;
  const modelOutage =
    scenario.modelOutage && dayIndex % 3 === scenario.modelOutage.dayOffsetMod
      ? scenario.modelOutage
      : null;

  // Forecast error is strongly autocorrelated: a model that is running high at
  // 10:00 is almost certainly still running high at 10:15. Independent per-block
  // noise would draw a jagged band nobody in operations would recognise, so each
  // model gets an AR(1) residual plus a few multi-block excursions.
  const residuals: Record<ModelId, number[]> = {
    external_qca: [],
    sunsure_internal: [],
    nevron: [],
  };
  for (const id of MODEL_IDS) {
    const p = PROFILES[id];
    const r = makeRand(hashSeed(plant.id, day, scenario.id, `res-${id}`));
    const series = new Array<number>(BLOCKS_PER_DAY).fill(0);
    let prev = r.normal(0, 1);
    for (let i = 0; i < BLOCKS_PER_DAY; i++) {
      prev = p.persistence * prev + Math.sqrt(1 - p.persistence ** 2) * r.normal(0, 1);
      series[i] = prev;
    }
    // Excursions: short windows where the model loses the plot entirely.
    const excursions = Math.round(p.spikeRate * BLOCKS_PER_DAY * scenario.errorScale);
    for (let e = 0; e < excursions; e++) {
      const centre = r.int(16, 84);
      const width = r.range(1.4, 4.2);
      const size = (r.chance(0.5) ? 1 : -1) * p.spikeSize * r.range(0.6, 1.4);
      for (let i = 0; i < BLOCKS_PER_DAY; i++) {
        const d = (i - centre) / width;
        series[i] += size * Math.exp(-d * d);
      }
    }
    residuals[id] = series;
  }


  const { sunrise, noonBlock } = solarWindow(doy);
  const rows: IntervalRecord[] = [];

  for (let block = 0; block < BLOCKS_PER_DAY; block++) {
    const potential = clearSky(block, plant.capacity_mw, doy);
    const daylight = potential > plant.capacity_mw * 0.02;

    /* ---- Actual ---------------------------------------------------------- */
    let actual: number | null = potential * truth[block];
    if (actual !== null && daylight) {
      actual = clamp(actual * (1 + rand.normal(0, 0.011)), 0, plant.capacity_mw);
    }

    let available = true;
    if (actualOutage && block >= actualOutage.from && block <= actualOutage.to) available = false;
    if (scenario.actualGapRate > 0 && rand.chance(scenario.actualGapRate)) available = false;
    if (!available) actual = null;

    /* ---- Ramp weighting -------------------------------------------------- */
    // Errors concentrate on the morning and evening ramps, not around noon.
    const rampPos = daylight
      ? clamp(Math.abs(block - noonBlock) / Math.max(noonBlock - sunrise, 1), 0, 1)
      : 0;
    const rampFactor = 1 + rampPos * 0.35;

    const values: Record<ModelId, number | null> = {
      external_qca: null,
      sunsure_internal: null,
      nevron: null,
    };

    for (const id of MODEL_IDS) {
      if (!daylight) {
        values[id] = 0;
        continue;
      }
      const p = PROFILES[id];
      const believed = p.skill * truth[block] + (1 - p.skill) * beliefs[id][block];
      const bias = p.bias + (scenario.biasOverride?.[id] ?? 0);

      // Noise is proportional to the forecast level, not to an absolute MW
      // amount. Deviation bands are a percentage of Actual, so an absolute-MW
      // error floor would punish every dawn and dusk block for a rounding-scale
      // miss — which is not how these feeds behave, and not what the bands
      // measure. The large misses come from cloud-timing error above, not here.
      const relativeError =
        residuals[id][block] *
        p.noise *
        scenario.errorScale *
        rampFactor *
        p.rampWeakness;
      const v = potential * believed * (1 + bias) * (1 + relativeError);

      // No model forecasts meaningfully above the clear-sky ceiling: a feed that
      // misses cloud cover predicts a clear day, it does not invent irradiance.
      // Each feed has its own ceiling, so clipping never makes two models agree
      // exactly on a dawn block.
      const ceiling = Math.min(plant.capacity_mw, potential * p.ceiling + plant.capacity_mw * 0.008);
      values[id] = clamp(v, 0, ceiling);
    }

    if (modelOutage && block >= modelOutage.from && block <= modelOutage.to) {
      values[modelOutage.model] = null;
    }

    /* ---- The submitted schedule -------------------------------------------
       The incumbent QCA forecast, unmodified: that feed is what gets declared.
       Modelling a separately-revised schedule made the settlement baseline
       differ from the QCA counterfactual, so the interface ended up carrying
       two columns for one fact. Where QCA has not reported, nothing was
       submitted and the schedule is null. */
    const schedule: number | null = daylight ? values.external_qca : 0;

    rows.push({
      timestamp: blockTimestamp(day, block),
      block,
      actual_mw: actual === null ? null : round(actual, 3),
      actual_available: available,
      external_qca_mw: values.external_qca === null ? null : round(values.external_qca, 3),
      sunsure_internal_mw:
        values.sunsure_internal === null ? null : round(values.sunsure_internal, 3),
      nevron_mw: values.nevron === null ? null : round(values.nevron, 3),
      schedule_mw: schedule === null ? null : round(schedule, 3),
      eligible: daylight && available,
      // Stamped by the service's single classification pass.
      bands: { external_qca: null, sunsure_internal: null, nevron: null },
    });
  }

  return rows;
}
