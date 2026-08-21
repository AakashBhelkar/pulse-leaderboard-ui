"use client";

import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { ArrowRight, LayoutGrid, TableProperties } from "lucide-react";
import { EChart } from "@/components/charts/echart";
import { axisLabelStyle, escapeHtml, tooltipShell, valueAxis } from "@/components/charts/chart-theme";
import { MODELS, MODEL_IDS } from "@/lib/config/models";
import { METRIC_CATALOG } from "@/lib/config/metric-catalog";
import type { DailyResponse } from "@/lib/types";
import { Card, CardHeader, ModelDot, Skeleton } from "@/components/ui/primitives";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { formatDay, formatDayWithWeekday } from "@/lib/utils/date";
import { formatPct } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type DailyMetric = "rmse_mw" | "mae_mw" | "band_a_pct";

const METRIC_OPTIONS: { key: DailyMetric; label: string }[] = [
  { key: "rmse_mw", label: "RMSE" },
  { key: "mae_mw", label: "MAE" },
  { key: "band_a_pct", label: "Band A" },
];

/**
 * Supporting evidence: locate the strong and weak days inside a range, then
 * jump straight to that day's 96-block detail (PRD §12.2).
 */
export function DailyEvidence({
  daily,
  isPending,
}: {
  daily?: DailyResponse;
  isPending?: boolean;
}) {
  const { openDay } = useWorkspace();
  const [metric, setMetric] = useState<DailyMetric>("rmse_mw");
  const [view, setView] = useState<"chart" | "table">("chart");

  const days = useMemo(() => daily?.days ?? [], [daily]);
  const def = METRIC_CATALOG[metric];

  const option = useMemo<EChartsOption>(() => {
    if (!days.length) return {};
    return {
      animationDuration: 460,
      grid: { left: 4, right: 8, top: 22, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipShell,
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(16,34,27,0.04)" } },
        formatter: (raw: unknown) => {
          const params = raw as { dataIndex: number }[];
          const day = days[params?.[0]?.dataIndex ?? 0];
          if (!day) return "";
          const best =
            metric === "band_a_pct"
              ? day.best_by_band_a
              : metric === "mae_mw"
                ? day.best_by_mae
                : day.best_by_rmse;
          const rows = MODEL_IDS.map((id) => {
            const m = day.models.find((x) => x.model === id);
            const meta = MODELS[id];
            const value = m ? (m[metric] as number) : null;
            return `<tr>
              <td style="padding:2px 0"><span style="display:inline-block;width:7px;height:7px;border-radius:99px;background:${meta.color}"></span>&nbsp;<span style="color:#6d776f">${escapeHtml(meta.name)}</span></td>
              <td style="text-align:right;padding-left:18px;color:${best === id ? "#f7cd7c" : "#fff"};font-variant-numeric:tabular-nums">${
                value === null ? "—" : metric === "band_a_pct" ? `${value.toFixed(1)}%` : value.toFixed(3)
              }</td>
            </tr>`;
          }).join("");
          return `<div style="font-family:var(--font-geist-sans),system-ui;min-width:220px">
            <div style="padding:9px 12px 7px;border-bottom:1px solid rgba(255,255,255,0.09);color:#fff;font-size:13px;font-weight:600">${escapeHtml(formatDayWithWeekday(day.date))}</div>
            <table style="border-collapse:collapse;font-size:12px;margin:6px 12px 8px;width:calc(100% - 24px)">${rows}</table>
            <div style="padding:6px 12px 9px;border-top:1px solid rgba(255,255,255,0.09);color:#546863;font-size:11px;display:flex;justify-content:space-between;gap:10px"><span>coverage ${day.coverage_pct.toFixed(1)}%</span><span>click to open 96 blocks</span></div>
          </div>`;
        },
      },
      xAxis: {
        type: "category",
        data: days.map((d) => formatDay(d.date, { year: false })),
        axisLine: { lineStyle: { color: "#e9ece5" } },
        axisTick: { show: false },
        axisLabel: { ...axisLabelStyle, hideOverlap: true },
      },
      yAxis: {
        ...valueAxis,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => (metric === "band_a_pct" ? `${v}%` : String(v)),
        },
      },
      series: MODEL_IDS.map((id) => ({
        name: MODELS[id].name,
        type: "bar" as const,
        barMaxWidth: 15,
        barGap: "12%",
        itemStyle: { color: MODELS[id].color, borderRadius: [3, 3, 0, 0], opacity: 0.92 },
        emphasis: { itemStyle: { opacity: 1 } },
        data: days.map((d) => {
          const m = d.models.find((x) => x.model === id);
          return m ? (m[metric] as number) : null;
        }),
      })),
    } as unknown as EChartsOption;
  }, [days, metric]);

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader
        title="Daily evidence"
        subtitle={`Per-day ${def.label} by model · ${days.length} ${days.length === 1 ? "day" : "days"} in range`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-line-strong bg-surface-sunken p-0.5">
              {METRIC_OPTIONS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMetric(m.key)}
                  className={cn(
                    "rounded-[6px] px-2 py-1 text-[11.5px] font-medium transition-colors",
                    metric === m.key
                      ? "bg-white text-ink shadow-[0_1px_2px_rgba(16,34,27,0.08)]"
                      : "text-ink-3",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex rounded-lg border border-line-strong bg-surface-sunken p-0.5">
              <button
                onClick={() => setView("chart")}
                aria-label="Chart view"
                className={cn(
                  "rounded-[6px] px-2 py-1 transition-colors",
                  view === "chart" ? "bg-white text-ink shadow-[0_1px_2px_rgba(16,34,27,0.08)]" : "text-ink-3",
                )}
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                onClick={() => setView("table")}
                aria-label="Table view"
                className={cn(
                  "rounded-[6px] px-2 py-1 transition-colors",
                  view === "table" ? "bg-white text-ink shadow-[0_1px_2px_rgba(16,34,27,0.08)]" : "text-ink-3",
                )}
              >
                <TableProperties className="size-3.5" />
              </button>
            </div>
          </div>
        }
      />

      {isPending || !daily ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-[248px] rounded-lg" />
        </div>
      ) : view === "chart" ? (
        <div className="flex-1 px-3 pb-3">
          <EChart
            option={option}
            notMerge
            style={{ height: 248 }}
            onGridClick={(i) => days[i] && openDay(days[i].date)}
            ariaLabel={`Daily ${def.label} by model`}
          />
        </div>
      ) : (
        <div className="scrollbar-slim max-h-[292px] flex-1 overflow-auto px-2 pb-2">
          <table className="w-full min-w-[560px] border-collapse">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left text-[10.5px] font-semibold tracking-[0.06em] text-ink-4 uppercase">
                  Date
                </th>
                <th className="px-3 py-2 text-left text-[10.5px] font-semibold tracking-[0.06em] text-ink-4 uppercase">
                  Coverage
                </th>
                <th className="px-3 py-2 text-left text-[10.5px] font-semibold tracking-[0.06em] text-ink-4 uppercase">
                  Best by {def.label}
                </th>
                {MODEL_IDS.map((id) => (
                  <th
                    key={id}
                    className="px-3 py-2 text-right text-[10.5px] font-semibold tracking-[0.06em] text-ink-4 uppercase"
                  >
                    {MODELS[id].shortName}
                  </th>
                ))}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const best =
                  metric === "band_a_pct"
                    ? day.best_by_band_a
                    : metric === "mae_mw"
                      ? day.best_by_mae
                      : day.best_by_rmse;
                return (
                  <tr
                    key={day.date}
                    className="cursor-pointer border-b border-line-soft last:border-0 hover:bg-surface-sunken"
                    onClick={() => openDay(day.date)}
                  >
                    <td className="px-3 py-2.5 text-[12.5px] font-medium whitespace-nowrap text-ink">
                      {formatDayWithWeekday(day.date)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="block h-1.5 w-14 overflow-hidden rounded-full bg-line-soft">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${day.coverage_pct}%`,
                              backgroundColor:
                                day.coverage_pct >= 99.5 ? "#1f9d6b" : "#e0a02a",
                            }}
                          />
                        </span>
                        <span className="tnum text-[11.5px] text-ink-3">
                          {formatPct(day.coverage_pct)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {best ? (
                        <span className="flex items-center gap-1.5">
                          <ModelDot color={MODELS[best].color} size={7} />
                          <span className="text-[12.5px] font-medium text-ink-2">
                            {MODELS[best].shortName}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[12.5px] text-ink-4">—</span>
                      )}
                    </td>
                    {MODEL_IDS.map((id) => {
                      const m = day.models.find((x) => x.model === id);
                      const value = m ? (m[metric] as number) : null;
                      return (
                        <td key={id} className="px-3 py-2.5 text-right">
                          <span
                            className={cn(
                              "tnum text-[12.5px] tabular-nums",
                              best === id ? "font-semibold text-hud" : "text-ink-2",
                            )}
                          >
                            {value === null
                              ? "—"
                              : metric === "band_a_pct"
                                ? `${value.toFixed(1)}%`
                                : value.toFixed(3)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right">
                      <ArrowRight className="ml-auto size-3.5 text-ink-4" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-line bg-surface-muted px-5 py-2.5 text-[11.5px] text-ink-3">
        Selecting a day opens the full 96-block investigation without losing the current
        range.
      </div>
    </Card>
  );
}

