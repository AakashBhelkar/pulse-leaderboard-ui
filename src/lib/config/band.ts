import type { BandBasis, PlantConfig } from "@/lib/types";

/**
 * The Band A boundary, named once.
 *
 * Band A is `|forecast − actual| ÷ actual ≤ tolerance`, and the chart's fill is
 * drawn on exactly that boundary. They are one thing, so the product uses one
 * name for it and reads the number from one accessor.
 *
 * The one case where they would come apart is if the backend classified against
 * the *real submitted schedule* instead of the model's forecast. A revised
 * intraday schedule is not any model's raw forecast, so the fill around Actual
 * would stop being the band edge. The payload already says which basis is in
 * play (`band_basis`), so `describeBoundary` branches on it rather than the UI
 * guessing.
 */

/** Band A's upper bound as a percentage of the block's Actual. */
export function bandAPct(plant: PlantConfig): number {
  return plant.official_band_thresholds[0].upto_pct ?? plant.visual_tolerance_pct;
}

export interface BoundaryCopy {
  /** Band A's tolerance for this plant, e.g. 10. */
  pct: number;
  /** Legend / chip label, e.g. "Band A ±10% of Actual". */
  label: string;
  /** Compact form for tight spaces, e.g. "Band A ±10%". */
  short: string;
  /** True when the fill's edge is the band edge — the normal case. */
  isBandEdge: boolean;
  /** What the fill means, in one sentence. */
  meaning: string;
}

export function describeBoundary(
  plant: PlantConfig,
  basis: BandBasis | null | undefined = "simulated_model_as_schedule",
): BoundaryCopy {
  const pct = bandAPct(plant);

  if (basis === "regulatory_schedule") {
    // Classified against the submitted schedule, so the Actual-centred fill is
    // a reading aid only and must not carry the band's name (PRD §15).
    return {
      pct,
      label: `Actual tolerance ±${pct}%`,
      short: `±${pct}% of Actual`,
      isBandEdge: false,
      meaning:
        `A ±${pct}% closeness guide around Actual. Band A here is classified against the ` +
        `submitted schedule, not against this fill, so the two can differ.`,
    };
  }

  return {
    pct,
    label: `Band A ±${pct}% of Actual`,
    short: `Band A ±${pct}%`,
    isBandEdge: true,
    meaning:
      `The Band A boundary: ±${pct}% of each block's Actual. A forecast outside this fill is ` +
      `a block outside Band A.`,
  };
}
