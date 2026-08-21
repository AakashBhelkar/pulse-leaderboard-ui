"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "./echart";
import {
  CHART_DIM,
  TIP,
  baseGrid,
  categoryAxis,
  escapeHtml,
  tooltipShell,
  valueAxis,
} from "./chart-theme";
import { ACTUAL_COLOR, MODELS, MODEL_FIELD, TOLERANCE_COLOR } from "@/lib/config/models";
import type { BandBasis, IntervalRecord, ModelId, PlantConfig } from "@/lib/types";
import { describeBoundary } from "@/lib/config/band";
import { blockToClock, formatDay, parseTimestampBlock, parseTimestampDay } from "@/lib/utils/date";

interface ForecastChartProps {
  intervals: IntervalRecord[];
  plant: PlantConfig;
  visibleModels: ModelId[];
  resolution: "15min" | "hourly";
  isSingleDay: boolean;
  /** Thicken the stretch of each forecast that leaves the tolerance envelope. */
  markBreaches?: boolean;
  onDayClick?: (date: string) => void;
  height?: number;
  showZoom?: boolean;
  /** Strips the axis labels and padding for use as a small multiple. */
  compact?: boolean;
  /** How the backend classified bands — decides what the fill is called. */
  bandBasis?: BandBasis | null;
}

/**
 * Primary evidence chart (PRD §10).
 *
 * Actual is the anchor: highest-contrast line, drawn above everything. The
 * tolerance spread is a translucent FILL around Actual — never a dotted
 * boundary, and never labelled "Band A".
 */
export function ForecastChart({
  intervals,
  plant,
  visibleModels,
  resolution,
  isSingleDay,
  markBreaches = true,
  onDayClick,
  height = 380,
  showZoom,
  compact = false,
  bandBasis,
}: ForecastChartProps) {
  const tol = plant.visual_tolerance_pct / 100;

  const days = useMemo(
    () => intervals.map((r) => parseTimestampDay(r.timestamp)),
    [intervals],
  );
  const blocks = useMemo(
    () => intervals.map((r) => parseTimestampBlock(r.timestamp)),
    [intervals],
  );

  const modelSeries = useMemo(
    () =>
      visibleModels.map((id) => ({
        id,
        meta: MODELS[id],
        values: intervals.map((r) => r[MODEL_FIELD[id]]),
      })),
    [intervals, visibleModels],
  );

  // Hit-test set for the proximity tooltip: Actual plus every visible forecast.
  const proximitySeries = useMemo(
    () => [intervals.map((r) => r.actual_mw), ...modelSeries.map((m) => m.values)],
    [intervals, modelSeries],
  );

  const option = useMemo<EChartsOption>(() => {
    const labels = intervals.map((_, i) => `${days[i]}#${blocks[i]}#${i}`);
    const actual = intervals.map((r) => r.actual_mw);
    // Envelope collapses to zero width at Actual = 0 and disappears entirely
    // where Actual is missing — it is only ever drawn around a real reading.
    const lower = intervals.map((r) => (r.actual_mw === null ? null : r.actual_mw * (1 - tol)));
    const spread = intervals.map((r) => (r.actual_mw === null ? null : r.actual_mw * 2 * tol));


    /* --- Contiguous missing-Actual windows, drawn as explicit gaps -------- */
    const gapAreas: { xAxis: string }[][] = [];
    let gapStart: number | null = null;
    intervals.forEach((r, i) => {
      const missing = r.actual_mw === null;
      if (missing && gapStart === null) gapStart = i;
      if (!missing && gapStart !== null) {
        gapAreas.push([{ xAxis: labels[gapStart] }, { xAxis: labels[i - 1] }]);
        gapStart = null;
      }
    });
    if (gapStart !== null) {
      gapAreas.push([{ xAxis: labels[gapStart] }, { xAxis: labels[labels.length - 1] }]);
    }

    /* --- Breach emphasis --------------------------------------------------
       Only the stretch of forecast that leaves the envelope is emphasised, and
       only by weight — the series keeps its own colour throughout (PRD §10.1). */
    const isBreach = (m: (typeof modelSeries)[number], i: number) => {
      const f = m.values[i];
      const a = intervals[i].actual_mw;
      if (f === null || a === null) return false;
      if (Math.abs(f - a) <= a * tol) return false;
      // Ignore near-zero night blocks, where any deviation is trivially outside
      // a percentage envelope but means nothing operationally.
      return a >= plant.capacity_mw * 0.02;
    };

    const breachSeries = markBreaches
      ? modelSeries.map((m) => {
          const data: (number | null)[] = intervals.map(() => null);
          for (let i = 0; i < intervals.length; i++) {
            if (!isBreach(m, i)) continue;
            data[i] = m.values[i];
            // Carry one neighbour on each side so a single breached block still
            // draws as a visible stroke rather than vanishing.
            if (i > 0 && data[i - 1] === null) data[i - 1] = m.values[i - 1];
            if (i + 1 < intervals.length) data[i + 1] = m.values[i + 1];
          }
          return {
            name: `${m.meta.name} outside tolerance`,
            type: "line" as const,
            data,
            showSymbol: false,
            connectNulls: false,
            smooth: 0.16,
            silent: true,
            z: 6,
            lineStyle: { color: m.meta.color, width: compact ? 2.2 : 2.9, opacity: 1 },
          };
        })
      : [];

    const dayCount = new Set(days).size;

    return {
      animationDuration: 420,
      animationEasing: "cubicOut",
      grid: compact
        ? { left: 2, right: 6, top: 10, bottom: showZoom ? 34 : 2, containLabel: true }
        : { ...baseGrid, bottom: showZoom ? 40 : 6, top: 26 },
      tooltip: {
        ...tooltipShell,
        // Driven manually by EChart's proximity hit-test so the card only
        // appears when the cursor is actually near a plotted value.
        triggerOn: "none",
        formatter: (raw: unknown) => {
          const params = raw as { dataIndex: number }[];
          const i = params?.[0]?.dataIndex ?? 0;
          const row = intervals[i];
          if (!row) return "";
          return renderTooltip({
            row,
            index: i,
            day: days[i],
            block: blocks[i],
            models: modelSeries,
            tol,
            isSingleDay,
            resolution,
            boundaryShort: describeBoundary(plant, bandBasis).short,
          });
        },
      },
      xAxis: {
        ...categoryAxis,
        data: labels,
        // Hidden on a compact panel unless it is zoomable, where the day labels
        // are what make the drill-down navigable.
        show: !compact || showZoom,
        axisLabel: {
          ...categoryAxis.axisLabel,
          hideOverlap: true,
          formatter: (_value: string, index: number) => {
            if (isSingleDay || dayCount === 1) {
              return blocks[index] % 4 === 0 ? blockToClock(blocks[index]) : "";
            }
            // One label per day, anchored at midday.
            return blocks[index] === 48 ? formatDay(days[index], { year: false }) : "";
          },
        },
        axisPointer: { z: 2 },
      },
      yAxis: {
        ...valueAxis,
        show: !compact,
        max: (v: { max: number }) => Math.ceil(Math.max(v.max, plant.capacity_mw * 0.35) * 1.08),
        min: 0,
        axisLabel: { ...valueAxis.axisLabel, formatter: (v: number) => `${v}` },
        name: compact ? undefined : "MW",
        nameTextStyle: { color: CHART_DIM, fontSize: 10, padding: [0, 0, 4, -22] },
        nameGap: 10,
      },
      dataZoom: showZoom
        ? [
            { type: "inside", throttle: 60 },
            {
              type: "slider",
              height: 14,
              bottom: 8,
              borderColor: "transparent",
              backgroundColor: "#f2f4ef",
              fillerColor: "rgba(28,99,73,0.10)",
              handleStyle: { color: "#ffffff", borderColor: "#c6cec2" },
              moveHandleStyle: { color: "#c6cec2" },
              dataBackground: {
                lineStyle: { color: "#c6cec2", width: 1 },
                areaStyle: { color: "#e6eae2" },
              },
              selectedDataBackground: {
                lineStyle: { color: "#1c6349", opacity: 0.5 },
                areaStyle: { color: "#1c6349", opacity: 0.12 },
              },
              labelFormatter: "",
            },
          ]
        : undefined,
      series: [
        /* Tolerance envelope: invisible baseline + translucent fill. Its edge is the
       plant's Band A boundary (±tolerance of Actual), so a forecast drawn outside
       this fill is a forecast the backend classified outside Band A. */
        {
          name: "tolerance-base",
          type: "line",
          stack: "tolerance",
          data: lower,
          lineStyle: { opacity: 0, width: 0 },
          areaStyle: { opacity: 0 },
          symbol: "none",
          silent: true,
          z: 1,
          animation: false,
        },
        {
          name: describeBoundary(plant, bandBasis).label,
          type: "line",
          stack: "tolerance",
          data: spread,
          lineStyle: { opacity: 0, width: 0 },
          areaStyle: { color: TOLERANCE_COLOR, opacity: 0.26, origin: "start" },
          symbol: "none",
          silent: true,
          z: 1,
          animation: false,
        },
        /* Forecast lines sit between the fill and Actual. */
        ...modelSeries.map((m) => ({
          name: m.meta.name,
          type: "line" as const,
          data: m.values,
          showSymbol: false,
          symbol: "circle",
          symbolSize: 6,
          connectNulls: false,
          smooth: 0.16,
          sampling: "lttb" as const,
          lineStyle: { color: m.meta.color, width: compact ? 1.2 : 1.6, opacity: 0.85 },
          itemStyle: { color: m.meta.color },
          emphasis: { focus: "none" as const },
          z: 4,
        })),
        ...breachSeries,
        /* Actual last so it is never overdrawn (PRD §10.2). */
        {
          name: "Actual",
          type: "line",
          data: actual,
          showSymbol: false,
          symbol: "circle",
          symbolSize: 7,
          connectNulls: false,
          smooth: 0.16,
          sampling: "lttb" as const,
          lineStyle: { color: ACTUAL_COLOR, width: compact ? 1.8 : 2.4 },
          itemStyle: { color: ACTUAL_COLOR },
          emphasis: { focus: "none" as const },
          z: 8,
          markArea: gapAreas.length
            ? {
                silent: true,
                itemStyle: {
                  color: "rgba(147,158,152,0.13)",
                  borderColor: "rgba(147,158,152,0.35)",
                  borderWidth: 1,
                  borderType: [3, 3] as unknown as number,
                },
                label: {
                  show: !compact,
                  position: "insideTop" as const,
                  distance: 6,
                  color: CHART_DIM,
                  fontSize: 9,
                  fontWeight: 600,
                  formatter: "NO TELEMETRY",
                },
                data: gapAreas,
              }
            : undefined,
        },
      ],
    } as unknown as EChartsOption;
  }, [
    intervals,
    days,
    blocks,
    modelSeries,
    tol,
    plant,
    isSingleDay,
    resolution,
    markBreaches,
    showZoom,
    compact,
    bandBasis,
  ]);

  const handleClick = onDayClick
    ? (index: number) => {
        const row = intervals[index];
        if (row) onDayClick(parseTimestampDay(row.timestamp));
      }
    : undefined;

  return (
    <EChart
      option={option}
      notMerge
      style={{ height }}
      onGridClick={handleClick}
      proximitySeries={proximitySeries}
      proximityPx={compact ? 30 : 42}
      ariaLabel={`Forecast versus actual generation for ${plant.name}. Actual line with the ${describeBoundary(plant, bandBasis).short} band and ${visibleModels.length} forecast models.`}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Tooltip                                                                     */
/* -------------------------------------------------------------------------- */

interface TooltipArgs {
  row: IntervalRecord;
  index: number;
  day: string;
  block: number;
  models: { id: ModelId; meta: (typeof MODELS)[ModelId]; values: (number | null)[] }[];
  tol: number;
  isSingleDay: boolean;
  resolution: "15min" | "hourly";
  /** What the shaded band is called, from the one naming helper. */
  boundaryShort: string;
}

function renderTooltip({
  row,
  index,
  day,
  block,
  models,
  tol,
  isSingleDay,
  resolution,
  boundaryShort,
}: TooltipArgs): string {
  const actual = row.actual_mw;
  const heading = isSingleDay
    ? blockToClock(block)
    : `${formatDay(day, { year: false })} · ${blockToClock(block)}`;
  const sub = resolution === "hourly" ? "hourly avg" : "15-min block";

  const rows = models
    .map((m) => {
      const value = m.values[index];
      const dot = `<span style="display:inline-block;width:6px;height:6px;border-radius:99px;background:${m.meta.color};box-shadow:0 0 6px ${m.meta.color}"></span>`;
      if (value === null) {
        return `<tr>
          <td style="padding:3px 0;white-space:nowrap">${dot}&nbsp;<span style="color:${TIP.label}">${escapeHtml(m.meta.name)}</span></td>
          <td style="text-align:right;color:${TIP.meta};padding-left:14px">no value</td>
          <td style="text-align:right;color:${TIP.meta};padding-left:12px">—</td>
        </tr>`;
      }
      let deviation = "";
      let status = "";
      if (actual !== null) {
        const diff = value - actual;
        const pct = actual > 0.05 ? (diff / actual) * 100 : null;
        deviation =
          pct === null
            ? `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(2)}`
            : `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
        const within = Math.abs(diff) <= actual * tol;
        status = within
          ? `<span style="color:${TIP.accent}">✓</span>`
          : `<span style="color:${TIP.warn}">!</span>`;
      }
      return `<tr>
        <td style="padding:3px 0;white-space:nowrap">${dot}&nbsp;<span style="color:${TIP.label}">${escapeHtml(m.meta.name)}</span></td>
        <td style="text-align:right;padding-left:14px;color:${TIP.value};font-variant-numeric:tabular-nums">${value.toFixed(2)}</td>
        <td style="text-align:right;padding-left:12px;color:${TIP.label};font-variant-numeric:tabular-nums">${deviation}</td>
        <td style="text-align:right;padding-left:10px;font-weight:700">${status}</td>
      </tr>`;
    })
    .join("");

  const actualRow =
    actual === null
      ? `<tr>
          <td style="padding:3px 0;white-space:nowrap"><span style="display:inline-block;width:6px;height:6px;border-radius:99px;background:${TIP.meta}"></span>&nbsp;<span style="color:${TIP.head};font-weight:600">Actual</span></td>
          <td colspan="3" style="text-align:right;padding-left:14px;color:${TIP.warn}">no telemetry — excluded</td>
        </tr>`
      : `<tr>
          <td style="padding:3px 0;white-space:nowrap"><span style="display:inline-block;width:6px;height:6px;border-radius:99px;background:#ffffff;box-shadow:0 0 6px #ffffff"></span>&nbsp;<span style="color:${TIP.head};font-weight:600">Actual</span></td>
          <td style="text-align:right;padding-left:14px;color:${TIP.head};font-weight:700;font-variant-numeric:tabular-nums">${actual.toFixed(2)}</td>
          <td colspan="2" style="text-align:right;padding-left:12px;color:${TIP.meta};font-size:10.5px">MW</td>
        </tr>`;

  const envelope =
    actual === null
      ? "not drawn"
      : `${(actual * (1 - tol)).toFixed(2)} – ${(actual * (1 + tol)).toFixed(2)} MW`;

  return `
  <div style="min-width:278px;font-family:var(--font-geist-mono),ui-monospace,monospace">
    <div style="padding:8px 12px 7px;border-bottom:1px solid ${TIP.rule};display:flex;align-items:baseline;justify-content:space-between;gap:12px">
      <span style="color:${TIP.head};font-size:12.5px;font-weight:700;letter-spacing:0.02em">${escapeHtml(heading)}</span>
      <span style="color:${TIP.meta};font-size:9.5px;text-transform:uppercase;letter-spacing:0.12em">${sub}</span>
    </div>
    <table style="border-collapse:collapse;font-size:11.5px;margin:6px 12px 4px;width:calc(100% - 24px)">
      ${actualRow}
      ${rows}
    </table>
    <div style="padding:7px 12px 8px;border-top:1px solid ${TIP.rule};font-size:10px;color:${TIP.meta};display:flex;justify-content:space-between;gap:12px;text-transform:uppercase;letter-spacing:0.08em">
      <span>${escapeHtml(boundaryShort)}</span>
      <span style="font-variant-numeric:tabular-nums;text-transform:none;letter-spacing:0">${envelope}</span>
    </div>
  </div>`;
}
