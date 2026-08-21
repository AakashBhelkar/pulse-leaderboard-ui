"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import {
  axisLabelStyle,
  escapeHtml,
  tooltipShell,
  valueAxis,
} from "@/components/charts/chart-theme";
import { MODELS, MODEL_FIELD, MODEL_IDS } from "@/lib/config/models";
import type { ModelId, PlantConfig, SeriesResponse } from "@/lib/types";
import { Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { blockToClock, parseTimestampBlock } from "@/lib/utils/date";

/**
 * Where in the day each model loses accuracy. Ramp hours and cloud passes have
 * very different signatures, and a period-average RMSE hides both.
 */
export function IntradayErrorProfile({
  series,
  plant,
  isPending,
  visibleModels,
}: {
  series?: SeriesResponse;
  plant: PlantConfig;
  isPending?: boolean;
  visibleModels: ModelId[];
}) {
  const option = useMemo<EChartsOption>(() => {
    if (!series) return {};

    // Mean absolute error per block-of-day, averaged over every day in range.
    const sums = new Map<ModelId, { total: number[]; count: number[] }>();
    for (const id of MODEL_IDS) {
      sums.set(id, { total: new Array(96).fill(0), count: new Array(96).fill(0) });
    }
    const hasDaylight: boolean[] = new Array(96).fill(false);

    for (const row of series.intervals) {
      const block = parseTimestampBlock(row.timestamp);
      if (row.actual_mw === null || !row.eligible) continue;
      hasDaylight[block] = true;
      for (const id of MODEL_IDS) {
        const value = row[MODEL_FIELD[id]];
        if (value === null) continue;
        const bucket = sums.get(id)!;
        bucket.total[block] += Math.abs(value - row.actual_mw);
        bucket.count[block] += 1;
      }
    }

    const blocks = Array.from({ length: 96 }, (_, i) => i).filter((i) => hasDaylight[i]);
    const labels = blocks.map((b) => blockToClock(b));

    return {
      animationDuration: 460,
      grid: { left: 4, right: 10, top: 28, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipShell,
        formatter: (raw: unknown) => {
          const params = raw as { dataIndex: number; seriesName: string; value: number }[];
          if (!params?.length) return "";
          const rows = params
            .map((p) => {
              const meta = MODEL_IDS.map((id) => MODELS[id]).find((m) => m.name === p.seriesName);
              return `<tr><td style="padding:2px 0"><span style="display:inline-block;width:7px;height:7px;border-radius:99px;background:${meta?.color}"></span>&nbsp;<span style="color:#6d776f">${escapeHtml(p.seriesName)}</span></td><td style="text-align:right;padding-left:18px;color:#fff;font-variant-numeric:tabular-nums">${p.value?.toFixed(3) ?? "—"} MW</td></tr>`;
            })
            .join("");
          return `<div style="font-family:var(--font-geist-sans),system-ui;min-width:210px">
            <div style="padding:9px 12px 7px;border-bottom:1px solid rgba(255,255,255,0.09);color:#fff;font-size:13px;font-weight:600">${escapeHtml(labels[params[0].dataIndex] ?? "")}</div>
            <table style="border-collapse:collapse;font-size:12px;margin:6px 12px 8px;width:calc(100% - 24px)">${rows}</table>
            <div style="padding:6px 12px 9px;border-top:1px solid rgba(255,255,255,0.09);color:#546863;font-size:11px">mean absolute error at this block</div>
          </div>`;
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#e9ece5" } },
        axisTick: { show: false },
        axisLabel: { ...axisLabelStyle, hideOverlap: true, interval: 7 },
      },
      yAxis: {
        ...valueAxis,
        axisLabel: { ...axisLabelStyle, formatter: (v: number) => `${v}` },
        name: "MW",
        nameTextStyle: { color: "#939e98", fontSize: 10, padding: [0, 0, 4, -18] },
      },
      series: MODEL_IDS.filter((id) => visibleModels.includes(id)).map((id) => {
        const bucket = sums.get(id)!;
        return {
          name: MODELS[id].name,
          type: "line" as const,
          smooth: 0.3,
          showSymbol: false,
          lineStyle: { color: MODELS[id].color, width: 1.7 },
          itemStyle: { color: MODELS[id].color },
          areaStyle: { color: MODELS[id].color, opacity: 0.06 },
          data: blocks.map((b) =>
            bucket.count[b] > 0
              ? Math.round((bucket.total[b] / bucket.count[b]) * 1000) / 1000
              : null,
          ),
        };
      }),
    } as unknown as EChartsOption;
  }, [series, visibleModels]);

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader
        title="Intraday error profile"
        subtitle={`Mean absolute error by time of day · ${plant.name} daylight blocks`}
      />
      <div className="flex-1 px-3 pb-3">
        {isPending || !series ? (
          <Skeleton className="h-[248px] rounded-lg" />
        ) : (
          <EChart
            option={option}
            notMerge
            style={{ height: 248 }}
            ariaLabel="Mean absolute error by time of day for each model"
          />
        )}
      </div>
      <div className="border-t border-line bg-surface-muted px-5 py-2.5 text-[11.5px] text-ink-3">
        Morning and evening ramps carry the most forecast risk — a period-average RMSE
        hides where the error actually lands.
      </div>
    </Card>
  );
}
