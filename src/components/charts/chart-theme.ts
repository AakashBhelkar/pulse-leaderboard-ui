import type { EChartsOption } from "echarts";

/** Shared chart chrome so every chart in the product reads as one system. */
export const CHART_INK = "#10221b";
export const CHART_MUTED = "#6b7872";
export const CHART_FAINT = "#939e98";
export const CHART_DIM = "#939e98";
export const CHART_GRID = "#e9ece5";
export const CHART_AXIS = "#e9ece5";

export const axisLabelStyle = {
  color: CHART_FAINT,
  fontSize: 11,
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
} as const;

export const baseGrid = {
  left: 8,
  right: 14,
  top: 16,
  bottom: 6,
  containLabel: true,
} as const;

/** Low-contrast horizontal guides only (PRD §19.2). */
export const valueAxis = {
  type: "value" as const,
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: axisLabelStyle,
  splitLine: { show: true, lineStyle: { color: CHART_GRID, width: 1 } },
};

export const categoryAxis = {
  type: "category" as const,
  boundaryGap: false,
  axisLine: { show: true, lineStyle: { color: CHART_AXIS } },
  axisTick: { show: false },
  axisLabel: axisLabelStyle,
  splitLine: { show: false },
};

/** High-contrast, compact, metric-aware tooltip card (PRD §19.2). */
export const tooltipShell: NonNullable<EChartsOption["tooltip"]> = {
  trigger: "axis",
  backgroundColor: "#071a13",
  borderWidth: 0,
  padding: 0,
  extraCssText:
    "border-radius:12px;box-shadow:0 16px 44px -12px rgba(7,26,19,0.55);overflow:hidden;",
  axisPointer: {
    type: "line",
    lineStyle: { color: "rgba(16,34,27,0.35)", width: 1, type: [4, 4] },
    label: { show: false },
  },
  // Keep the card off the point being inspected (PRD §22.2).
  confine: true,
  appendToBody: false,
};

/** Tooltip body colours, kept in one place so every chart's card matches. */
export const TIP = {
  head: "#ffffff",
  label: "#dcf1e8",
  value: "#ffffff",
  meta: "#74c4a4",
  accent: "#74c4a4",
  warn: "#f7cd7c",
  rule: "rgba(255,255,255,0.09)",
} as const;

/** Sequenced palette for selection groups on the comparison workspace. */
export const SELECTION_ACCENTS = [
  "#12392c",
  "#c07f12",
  "#2f6f9e",
  "#6d5ce7",
  "#a4243f",
  "#1f9d6b",
] as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
