"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import {
  TIP,
  axisLabelStyle,
  escapeHtml,
  tooltipShell,
  valueAxis,
} from "@/components/charts/chart-theme";
import { MODELS, MODEL_IDS } from "@/lib/config/models";
import type { EvaluationSummary } from "@/lib/types";
import { formatInt } from "@/lib/utils/format";

/**
 * The official band distribution, as bars.
 *
 * Extracted so the fleet overview and the plant monitor draw the identical
 * chart from the identical numbers — `summary.models[].band_counts`, which is
 * the same per-block classification the interval table prints.
 */
export function BandBars({
  summary,
  mode = "count",
  height = 248,
  compact = false,
}: {
  summary: EvaluationSummary;
  mode?: "count" | "share";
  height?: number;
  compact?: boolean;
}) {
  const option = useMemo<EChartsOption>(() => {
    const bands = summary.plant.official_bands;
    const total = summary.coverage.eligible_intervals || 1;
    const bandAPct = summary.plant.official_band_thresholds[0].upto_pct;

    return {
      animationDuration: 480,
      grid: {
        left: 4,
        right: 8,
        top: compact ? 20 : 26,
        bottom: 4,
        containLabel: true,
      },
      tooltip: {
        ...tooltipShell,
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(16,34,27,0.04)" } },
        formatter: (raw: unknown) => {
          const params = raw as { name: string; seriesName: string; value: number }[];
          if (!params?.length) return "";
          const rows = params
            .map((p) => {
              const meta = MODEL_IDS.map((id) => MODELS[id]).find(
                (m) => m.name === p.seriesName,
              );
              const count =
                mode === "count" ? p.value : Math.round((p.value / 100) * total);
              const share = ((count / total) * 100).toFixed(1);
              return `<tr>
                <td style="padding:2px 0"><span style="display:inline-block;width:7px;height:7px;border-radius:99px;background:${meta?.color ?? "#fff"}"></span>&nbsp;<span style="color:${TIP.label}">${escapeHtml(p.seriesName)}</span></td>
                <td style="text-align:right;padding-left:16px;color:${TIP.value};font-variant-numeric:tabular-nums">${formatInt(count)}</td>
                <td style="text-align:right;padding-left:10px;color:${TIP.meta};font-variant-numeric:tabular-nums">${share}%</td>
              </tr>`;
            })
            .join("");
          return `<div style="font-family:var(--font-geist-sans),system-ui;min-width:230px">
            <div style="padding:9px 12px 7px;border-bottom:1px solid ${TIP.rule};color:${TIP.head};font-size:13px;font-weight:600">${escapeHtml(params[0].name)}</div>
            <table style="border-collapse:collapse;font-size:12px;margin:6px 12px 8px;width:calc(100% - 24px)">${rows}</table>
            <div style="padding:6px 12px 9px;border-top:1px solid ${TIP.rule};color:${TIP.meta};font-size:11px">of ${formatInt(total)} eligible blocks · deviation vs Actual</div>
          </div>`;
        },
      },
      xAxis: {
        type: "category",
        data: bands.map((b) =>
          compact
            ? `Band ${b}`
            : `Band ${b}${b === "A" ? ` (free · ≤${bandAPct}%)` : ""}`,
        ),
        axisLine: { lineStyle: { color: "#e9ece5" } },
        axisTick: { show: false },
        axisLabel: {
          ...axisLabelStyle,
          color: "#46544d",
          fontWeight: 500,
          fontSize: compact ? 10.5 : 11,
        },
      },
      yAxis: {
        ...valueAxis,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => (mode === "share" ? `${v}%` : formatInt(v)),
        },
      },
      series: MODEL_IDS.map((id) => {
        const meta = MODELS[id];
        const model = summary.models.find((m) => m.model === id);
        return {
          name: meta.name,
          type: "bar" as const,
          barMaxWidth: compact ? 22 : 34,
          barGap: "18%",
          itemStyle: { color: meta.color, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { opacity: 0.86 } },
          label: {
            show: true,
            position: "top" as const,
            fontSize: compact ? 9.5 : 10.5,
            fontWeight: 600,
            color: "#6b7872",
            formatter: (p: { value: number }) =>
              mode === "share"
                ? `${p.value.toFixed(1)}%`
                : p.value > 0
                  ? formatInt(p.value)
                  : "",
          },
          data: bands.map((b) => {
            const count = model?.band_counts?.[b] ?? 0;
            return mode === "share" ? Number(((count / total) * 100).toFixed(1)) : count;
          }),
        };
      }),
    } as unknown as EChartsOption;
  }, [summary, mode, compact]);

  return (
    <EChart
      option={option}
      notMerge
      style={{ height }}
      ariaLabel={`Official band distribution by model for ${summary.plant.name}`}
    />
  );
}
