"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { EChart } from "@/components/charts/echart";
import { Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { MetricTooltip } from "@/components/metrics/metric-tooltip";
import { MODELS, MODEL_IDS } from "@/lib/config/models";
import { bandAPct } from "@/lib/config/band";
import { axisLabelStyle } from "@/components/charts/chart-theme";
import type { CompareRow } from "@/lib/types";
import { formatInt } from "@/lib/utils/format";

/**
 * Band A compliance across every selection.
 *
 * Shown outright rather than hidden behind the metric picker: compliance is the
 * question the settlement conversation actually turns on, and a reader should
 * not have to change a dropdown to find it.
 *
 * Reported as blocks, with the percentage beneath — the same treatment the
 * fleet tiles use, because "49 of 52 blocks" can be checked against the block
 * table while a percentage has to be taken on trust.
 */
export function BandAComparison({
  rows,
  accents,
  isPending,
}: {
  rows?: CompareRow[];
  accents: string[];
  isPending?: boolean;
}) {
  /* Band A's threshold is per plant, so a chart spanning plants is comparing
     compliance against two different rules. Worth saying, not worth hiding. */
  const thresholds = useMemo(() => {
    if (!rows) return [];
    return [...new Set(rows.map((r) => bandAPct(r.plant)))].sort((a, b) => a - b);
  }, [rows]);
  const mixedThresholds = thresholds.length > 1;

  const option = useMemo<EChartsOption>(() => {
    if (!rows?.length) return {};
    return {
      animationDuration: 460,
      grid: { left: 4, right: 20, top: 30, bottom: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(16,34,27,0.04)" } },
        valueFormatter: (v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : "—"),
      },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 9,
        itemHeight: 9,
        itemGap: 16,
        textStyle: { fontSize: 11, color: "#4a5b52" },
        data: MODEL_IDS.map((id) => MODELS[id].name),
      },
      xAxis: {
        type: "category",
        data: rows.map((r, i) => `${i + 1}. ${r.plant.name}`),
        axisLine: { lineStyle: { color: "#e9ece5" } },
        axisTick: { show: false },
        axisLabel: { ...axisLabelStyle },
      },
      yAxis: {
        type: "value",
        max: 100,
        name: "Band A %",
        nameTextStyle: { fontSize: 10, color: "#8a998f", align: "left" },
        splitLine: { lineStyle: { color: "#f0f3ee" } },
        axisLabel: { ...axisLabelStyle, formatter: "{value}%" },
      },
      series: MODEL_IDS.map((id) => ({
        name: MODELS[id].name,
        type: "bar",
        barMaxWidth: 26,
        itemStyle: { color: MODELS[id].color, borderRadius: [3, 3, 0, 0] },
        data: rows.map((r) => r.models.find((m) => m.model === id)?.band_a_pct ?? null),
      })),
    } as unknown as EChartsOption;
  }, [rows]);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Band A compliance"
        subtitle={
          mixedThresholds
            ? `Blocks inside tolerance — measured against each plant's own threshold (±${thresholds.join("%, ±")}%)`
            : `Blocks inside tolerance — ±${thresholds[0] ?? "—"}% of Actual`
        }
      />

      {isPending || !rows?.length ? (
        <div className="p-5">
          <Skeleton className="h-[240px]" />
        </div>
      ) : (
        <>
          <div className="px-3 pt-3">
            <EChart
              option={option}
              style={{ height: 240 }}
              ariaLabel="Band A percentage by selection and model"
            />
          </div>

          {/* The counts, because a bar chart cannot show a denominator. */}
          <div className="scrollbar-slim overflow-x-auto border-t border-line-soft">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="bg-surface-muted">
                  <th className="px-4 py-2 text-left text-[10px] font-semibold tracking-[0.1em] text-ink-4 uppercase">
                    Selection
                  </th>
                  {MODEL_IDS.map((id) => (
                    <th key={id} className="px-3 py-2 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-[3px] rounded-full"
                          style={{ backgroundColor: MODELS[id].color }}
                        />
                        <span className="text-[10px] font-semibold tracking-[0.1em] text-ink-4 uppercase">
                          {MODELS[id].shortName}
                        </span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.selection.id} className="border-t border-line-soft">
                    <th scope="row" className="px-4 py-2.5 text-left">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="grid size-4 shrink-0 place-items-center rounded-[2px] text-[9px] font-bold text-ink-inverse"
                          style={{ backgroundColor: accents[i % accents.length] }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-[12.5px] font-semibold whitespace-nowrap text-ink">
                          {row.plant.name}
                        </span>
                        <span className="text-[10.5px] whitespace-nowrap text-ink-4">
                          ±{bandAPct(row.plant)}%
                        </span>
                      </span>
                    </th>
                    {MODEL_IDS.map((id) => {
                      const model = row.models.find((m) => m.model === id);
                      const inBand = model?.band_counts.A ?? null;
                      const eligible = row.coverage.eligible_intervals;
                      const won = row.winners.band_a_pct === id;
                      return (
                        <td key={id} className="px-3 py-2.5 text-right">
                          <MetricTooltip
                            metric="band_a_pct"
                            value={model ? `${model.band_a_pct.toFixed(1)}%` : "—"}
                            evaluatedIntervals={model?.evaluated_intervals}
                            bandBasis={model?.band_basis}
                            side="left"
                          >
                            <span className="inline-block cursor-help text-right">
                              <span
                                className={
                                  won
                                    ? "readout block text-[13px] leading-none font-semibold text-hud"
                                    : "readout block text-[13px] leading-none text-ink"
                                }
                              >
                                {inBand === null ? "—" : `${formatInt(inBand)}/${formatInt(eligible)}`}
                              </span>
                              <span className="tnum mt-1 block text-[10.5px] text-ink-3">
                                {model ? `${model.band_a_pct.toFixed(1)}%` : ""}
                              </span>
                            </span>
                          </MetricTooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mixedThresholds ? (
            <p className="border-t border-line bg-surface-muted px-5 py-3 text-[11.5px] leading-relaxed text-ink-3">
              These selections use different Band A thresholds, so the percentages answer
              &ldquo;did it meet its own plant&rsquo;s rule&rdquo; — not &ldquo;which plant was
              forecast better&rdquo;. Use NRMSE for that.
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}
