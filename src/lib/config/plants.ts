import type { PlantConfig, PlantId } from "@/lib/types";

/**
 * Plant configuration (PRD §17).
 *
 * Band thresholds are percentages of ACTUAL generation for the block. Band A's
 * upper bound is the plant's regulatory tolerance — ±10% in UP, ±15% in
 * Maharashtra — which is the same figure `visual_tolerance_pct` uses to size the
 * chart envelope. The two stay equal by construction below: the envelope is
 * drawn at the Band A boundary, so a forecast visibly outside the envelope is a
 * forecast outside Band A.
 *
 * They remain distinct fields because they remain distinct concepts: the
 * envelope is a display aid this frontend draws, the bands are the backend's
 * authoritative classification (PRD §15). Only their basis now agrees.
 */
/* Band A's tolerance for each plant, declared once. Both the band threshold and
   the chart envelope read it, so they cannot drift apart. */
const GURSARAI_TOLERANCE = 10;
const ERANDOL_TOLERANCE = 15;

/* PPA tariff per plant. Only the rupee amounts depend on this — DSM as a share
   of revenue is tariff-independent. Replace with the real contracted rates. */
const GURSARAI_TARIFF = 3.0;
const ERANDOL_TARIFF = 3.0;

export const PLANTS: Record<PlantId, PlantConfig> = {
  gursarai: {
    id: "gursarai",
    name: "Gursarai",
    state: "Uttar Pradesh",
    state_short: "UP",
    capacity_mw: 12,
    visual_tolerance_pct: GURSARAI_TOLERANCE,
    official_bands: ["A", "B", "C", "D"],
    official_band_thresholds: [
      { band: "A", upto_pct: GURSARAI_TOLERANCE },
      { band: "B", upto_pct: 15 },
      { band: "C", upto_pct: 20 },
      { band: "D", upto_pct: null },
    ],
    tariff_inr_per_kwh: GURSARAI_TARIFF,
    time_zone: "Asia/Kolkata",
    commissioned: "2024-03",
    data_from: "2026-06-01",
    data_to: "2026-08-18",
  },
  erandol: {
    id: "erandol",
    name: "Erandol",
    state: "Maharashtra",
    state_short: "MH",
    capacity_mw: 20,
    visual_tolerance_pct: ERANDOL_TOLERANCE,
    official_bands: ["A", "B", "C", "D", "E"],
    official_band_thresholds: [
      { band: "A", upto_pct: ERANDOL_TOLERANCE },
      { band: "B", upto_pct: 20 },
      { band: "C", upto_pct: 25 },
      { band: "D", upto_pct: 30 },
      { band: "E", upto_pct: null },
    ],
    tariff_inr_per_kwh: ERANDOL_TARIFF,
    time_zone: "Asia/Kolkata",
    commissioned: "2023-11",
    data_from: "2026-06-01",
    data_to: "2026-08-18",
  },
};

export const PLANT_LIST = Object.values(PLANTS);

export function getPlant(id: string): PlantConfig | null {
  return PLANTS[id as PlantId] ?? null;
}

/** Latest day with complete evaluation data across the fleet. */
export const LATEST_DATA_DATE = "2026-08-18";

export const DEFAULT_PLANT: PlantId = "gursarai";
