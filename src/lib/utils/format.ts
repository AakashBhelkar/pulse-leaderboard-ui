import type { Direction } from "@/lib/config/metric-catalog";
import type { MetricKey } from "@/lib/types";

export function formatMw(value: number | null | undefined, dp = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(dp);
}

export function formatPct(value: number | null | undefined, dp = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(dp)}%`;
}

export function formatSigned(value: number | null | undefined, dp = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(dp)}`;
}

export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-IN");
}

/** Renders a metric value using its canonical unit and precision. */
export function formatMetric(key: MetricKey, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  switch (key) {
    case "rmse_mw":
    case "mae_mw":
      return value.toFixed(3);
    case "bias_mw":
      return formatSigned(value, 3);
    case "band_a_pct":
    case "outside_band_a_pct":
      return `${value.toFixed(1)}%`;
    case "estimated_dsm_impact_pct":
      return `${value.toFixed(2)}%`;
    default:
      return String(value);
  }
}

export function metricUnit(key: MetricKey): string {
  return key.endsWith("_pct") ? "" : "MW";
}

/** Relative gap to the winning value, used for the "+0.35 vs best" chips. */
export function deltaToBest(
  value: number,
  best: number,
  direction: Direction,
): { delta: number; worse: boolean } {
  if (direction === "zero") {
    const delta = Math.abs(value) - Math.abs(best);
    return { delta, worse: delta > 0 };
  }
  const delta = direction === "higher" ? best - value : value - best;
  return { delta, worse: delta > 0 };
}

export function pluralise(n: number, one: string, many = `${one}s`) {
  return n === 1 ? one : many;
}

/* -------------------------------------------------------------------------- */
/* Currency                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Rupees in Indian units — thousand, lakh, crore.
 *
 * Deviation penalties over a month run from thousands to tens of lakhs, and
 * "₹24,10,000" is far harder to size up at a glance than "₹24.1 L".
 */
export function formatInr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}k`;
  return `${sign}₹${Math.round(abs)}`;
}

/** Same scale, but always signed — for "better/worse than baseline" deltas. */
export function formatInrDelta(value: number): string {
  if (Math.round(value) === 0) return "—";
  return `${value > 0 ? "+" : "−"}${formatInr(Math.abs(value)).replace("₹", "₹")}`;
}
