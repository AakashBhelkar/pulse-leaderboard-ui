"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import { TIP, escapeHtml, tooltipShell } from "@/components/charts/chart-theme";
import { MODELS, MODEL_IDS } from "@/lib/config/models";
import type { DailyResponse } from "@/lib/types";
import { formatDayWithWeekday } from "@/lib/utils/date";

/**
 * Daily Band A share per model, as a sparkline.
 *
 * A period average says a model held Band A 83% of the time. It does not say
 * whether that was 83% every day or 98% for a week and 40% for three days —
 * which is the difference between a model you can schedule against and one you
 * cannot. This strip shows that, and nothing else.
 */
export function BandTrend({
  daily,
  height = 74,
}: {
  daily: DailyResponse;
  height?: number;
}) {
  const option = useMemo<EChartsOption>(() => {
    const days = daily.days;

    /* 100% stays pinned to the top, because distance from perfect compliance is
       the thing being read. The floor tracks the data instead of sitting at 0 —
       a fixed 0 crushed a 75–95% series into the top fifth of the strip, which
       looked tidy and said nothing. */
    const values = days.flatMap((d) => d.models.map((m) => m.band_a_pct));
    const lowest = values.length ? Math.min(...values) : 0;
    const floor = Math.max(0, Math.floor((lowest - 6) / 5) * 5);

    return {
      animationDuration: 520,
      grid: { left: 2, right: 2, top: 8, bottom: 5, containLabel: false },
      tooltip: {
        ...tooltipShell,
        trigger: "axis",
        axisPointer: {
          type: "line",
          lineStyle: { color: "rgba(16,34,27,0.22)", width: 1, type: [3, 3] },
        },
        formatter: (raw: unknown) => {
          const params = raw as { dataIndex: number }[];
          const day = days[params?.[0]?.dataIndex ?? 0];
          if (!day) return "";
          const rows = MODEL_IDS.map((id) => {
            const m = day.models.find((x) => x.model === id);
            const meta = MODELS[id];
            return `<tr>
              <td style="padding:2px 0"><span style="display:inline-block;width:7px;height:7px;border-radius:99px;background:${meta.color}"></span>&nbsp;<span style="color:${TIP.label}">${escapeHtml(meta.shortName)}</span></td>
              <td style="text-align:right;padding-left:18px;color:${TIP.value};font-variant-numeric:tabular-nums">${m ? `${m.band_a_pct.toFixed(1)}%` : "—"}</td>
            </tr>`;
          }).join("");
          return `<div style="font-family:var(--font-geist-sans),system-ui;min-width:190px">
            <div style="padding:9px 12px 7px;border-bottom:1px solid ${TIP.rule};color:${TIP.head};font-size:13px;font-weight:600">${escapeHtml(formatDayWithWeekday(day.date))}</div>
            <table style="border-collapse:collapse;font-size:12px;margin:6px 12px 8px;width:calc(100% - 24px)">${rows}</table>
            <div style="padding:6px 12px 9px;border-top:1px solid ${TIP.rule};color:${TIP.meta};font-size:11px">Band A share of ${day.eligible_intervals} eligible blocks</div>
          </div>`;
        },
      },
      xAxis: {
        type: "category",
        show: false,
        boundaryGap: false,
        data: days.map((d) => d.date),
      },
      yAxis: {
        type: "value",
        show: false,
        min: floor,
        max: 100,
        // A hairline at 100% so the top edge reads as "every block in Band A"
        // rather than as an arbitrary crop.
        splitLine: {
          show: true,
          lineStyle: { color: "rgba(16,34,27,0.07)", type: [3, 3] },
        },
        interval: 100 - floor,
      },
      series: MODEL_IDS.map((id) => ({
        name: MODELS[id].shortName,
        type: "line" as const,
        smooth: 0.28,
        showSymbol: true,
        symbolSize: 0,
        symbol: "circle",
        lineStyle: { color: MODELS[id].color, width: 1.7 },
        itemStyle: { color: MODELS[id].color },
        emphasis: { focus: "none" as const },
        data: days.map((d, i) => {
          const value = d.models.find((x) => x.model === id)?.band_a_pct ?? null;
          if (value === null) return null;
          // The last point gets a visible dot: it is the number printed beside
          // the strip, and the eye needs somewhere to land.
          return i === days.length - 1
            ? { value, symbol: "circle", symbolSize: 6 }
            : value;
        }),
      })),
    } as unknown as EChartsOption;
  }, [daily]);

  return (
    <EChart
      option={option}
      notMerge
      style={{ height }}
      ariaLabel="Daily Band A share per model across the selected period"
    />
  );
}
