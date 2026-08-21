"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, TriangleAlert } from "lucide-react";
import { MODELS, MODEL_IDS } from "@/lib/config/models";
import { ModelLogo } from "@/components/brand/model-logo";
import { METRIC_CATALOG, directionText } from "@/lib/config/metric-catalog";
import type { EvaluationSummary, MetricKey, ModelSummary } from "@/lib/types";
import { MetricTooltip } from "@/components/metrics/metric-tooltip";
import { MetricReferenceDialog } from "@/components/metrics/metric-reference-dialog";
import {
  Badge,
  Card,
  CardHeader,
  DirectionArrow,
  ModelDot,
  Skeleton,
  WinnerMark,
} from "@/components/ui/primitives";
import { formatInt, formatMetric } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const COLUMNS: { key: MetricKey; label: string; width: string }[] = [
  { key: "rmse_mw", label: "RMSE", width: "w-[13%]" },
  { key: "mae_mw", label: "MAE", width: "w-[13%]" },
  { key: "bias_mw", label: "Bias", width: "w-[12%]" },
  { key: "band_a_pct", label: "Band A", width: "w-[12%]" },
  { key: "outside_band_a_pct", label: "Outside A", width: "w-[12%]" },
  { key: "estimated_dsm_impact_pct", label: "DSM impact", width: "w-[13%]" },
];

/**
 * The authoritative comparison surface (PRD §8).
 *
 * Row order is model identity by default. A column can be brought into focus to
 * sort — that is an explicit user action, never a composite ranking, and the
 * winner marks stay independent per metric regardless of sort.
 */
export function Leaderboard({
  summary,
  isPending,
}: {
  summary?: EvaluationSummary;
  isPending?: boolean;
}) {
  const [focus, setFocus] = useState<MetricKey | null>(null);

  const rows = useMemo(() => {
    if (!summary) return [];
    const byId = new Map(summary.models.map((m) => [m.model, m]));
    const ordered = MODEL_IDS.map((id) => byId.get(id)).filter(Boolean) as ModelSummary[];
    if (!focus) return ordered;
    const dir = METRIC_CATALOG[focus].direction;
    return [...ordered].sort((a, b) => {
      const av = a[focus] as number | null;
      const bv = b[focus] as number | null;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (dir === "higher") return bv - av;
      if (dir === "zero") return Math.abs(av) - Math.abs(bv);
      return av - bv;
    });
  }, [summary, focus]);

  // Column extents drive the in-cell micro-bars.
  const extents = useMemo(() => {
    const out: Partial<Record<MetricKey, { min: number; max: number }>> = {};
    if (!summary) return out;
    for (const col of COLUMNS) {
      const values = summary.models
        .map((m) => m[col.key] as number | null)
        .filter((v): v is number => v !== null)
        .map((v) => (col.key === "bias_mw" ? Math.abs(v) : v));
      if (values.length) out[col.key] = { min: Math.min(...values), max: Math.max(...values) };
    }
    return out;
  }, [summary]);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Model leaderboard"
        subtitle={
          summary
            ? `${formatInt(summary.coverage.eligible_intervals)} eligible 15-minute intervals · ${summary.coverage.days} ${summary.coverage.days === 1 ? "day" : "days"}`
            : undefined
        }
        actions={<MetricReferenceDialog />}
      />

      <div className="px-5 pb-1">
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-[11.5px] text-ink-3">
          <span className="font-semibold text-ink-2">Winners are per metric.</span>
          No overall score or composite ranking is computed — a model can lead on error
          and trail on band compliance.
          {focus ? (
            <button
              onClick={() => setFocus(null)}
              className="ml-auto rounded-md px-2 py-1 text-[11px] font-semibold text-hud hover:bg-tint"
            >
              Sorted by {METRIC_CATALOG[focus].label} · reset
            </button>
          ) : null}
        </div>
      </div>

      {isPending || !summary ? (
        <div className="space-y-2 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="scrollbar-slim overflow-x-auto px-2 pt-1 pb-2">
          <table className="w-full min-w-[880px] border-collapse">
            <thead>
              <tr>
                <th className="w-[24%] px-3 py-2.5 text-left">
                  <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-4 uppercase">
                    Model
                  </span>
                </th>
                {COLUMNS.map((col) => {
                  const def = METRIC_CATALOG[col.key];
                  const active = focus === col.key;
                  return (
                    <th key={col.key} className={cn("px-3 py-2.5 text-right", col.width)}>
                      <div className="flex items-center justify-end gap-1">
                        <MetricTooltip
                          metric={col.key}
                          evaluatedIntervals={summary.coverage.eligible_intervals}
                          dsmBasis={
                            col.key === "estimated_dsm_impact_pct"
                              ? summary.models[0]?.dsm_basis
                              : null
                          }
                          bandBasis={
                            col.key === "band_a_pct" || col.key === "outside_band_a_pct"
                              ? summary.models[0]?.band_basis
                              : null
                          }
                        >
                          <button
                            onClick={() => setFocus(active ? null : col.key)}
                            className={cn(
                              "group inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold tracking-[0.05em] uppercase transition-colors",
                              active
                                ? "bg-tint text-hud"
                                : "text-ink-4 hover:bg-canvas-deep hover:text-ink-2",
                            )}
                            title={`${def.label} — ${directionText(def.direction)}. Click to sort.`}
                          >
                            {col.label}
                            <DirectionArrow direction={def.direction} />
                            <ArrowUpDown
                              className={cn(
                                "size-3 transition-opacity",
                                active ? "opacity-70" : "opacity-0 group-hover:opacity-40",
                              )}
                            />
                          </button>
                        </MetricTooltip>
                      </div>
                    </th>
                  );
                })}
                <th className="w-[12%] px-3 py-2.5 text-right">
                  <MetricTooltip metric="eligible">
                    <span className="cursor-help text-[11px] font-semibold tracking-[0.06em] text-ink-4 uppercase">
                      Coverage
                    </span>
                  </MetricTooltip>
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const meta = MODELS[row.model];
                const uneven =
                  row.model_available_intervals !== summary.coverage.eligible_intervals;
                return (
                  <tr
                    key={row.model}
                    className="group border-t border-line-soft transition-colors hover:bg-surface-sunken/60"
                  >
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="h-8 w-[3px] shrink-0 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-[13.5px] leading-tight font-semibold tracking-[-0.01em] text-ink">
                            {meta.name}
                            {meta.brand ? <ModelLogo model={row.model} height={15} /> : null}
                          </p>
                          <p className="mt-0.5 text-[11px] text-ink-4">{meta.vendor}</p>
                        </div>
                      </div>
                    </td>

                    {COLUMNS.map((col) => {
                      const value = row[col.key] as number | null;
                      const isWinner = summary.winners[col.key] === row.model;
                      const extent = extents[col.key];
                      const magnitude =
                        value === null || !extent || extent.max === extent.min
                          ? 0
                          : ((col.key === "bias_mw" ? Math.abs(value) : value) - extent.min) /
                            (extent.max - extent.min);
                      const showBar = focus === col.key;

                      return (
                        <td key={col.key} className="px-3 py-3.5 text-right align-middle">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5">
                              {isWinner ? <WinnerMark /> : null}
                              <span
                                className={cn(
                                  "tnum text-[13.5px] tracking-[-0.01em] tabular-nums",
                                  isWinner
                                    ? "font-semibold text-hud"
                                    : "font-medium text-ink",
                                  value === null && "text-ink-4",
                                )}
                              >
                                {formatMetric(col.key, value)}
                              </span>
                            </div>
                            {showBar ? (
                              <span className="block h-1 w-full max-w-[84px] overflow-hidden rounded-full bg-line-soft">
                                <span
                                  className="block h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.max(6, (1 - magnitude) * 100)}%`,
                                    backgroundColor: meta.color,
                                    opacity: isWinner ? 1 : 0.45,
                                  }}
                                />
                              </span>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}

                    <td className="px-3 py-3.5 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="tnum text-[12.5px] font-medium text-ink-2">
                          {formatInt(row.evaluated_intervals)}
                        </span>
                        {uneven ? (
                          <Badge tone="caution" className="gap-1">
                            <TriangleAlert className="size-2.5" />
                            {formatInt(row.model_available_intervals)} supplied
                          </Badge>
                        ) : (
                          <span className="text-[10.5px] text-ink-4">blocks scored</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {summary ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-surface-muted px-5 py-3 text-[11.5px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <ModelDot color="#12392c" size={7} />
            Metrics computed on the common eligible interval set
          </span>
          <span>
            Band A share is the official backend classification, not the chart&apos;s visual
            tolerance
          </span>
          {summary.models[0]?.dsm_basis === "simulated_model_attribution" ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full bg-warn" />
              DSM impact is a simulated model attribution
            </span>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function CoverageNote({ summary }: { summary: EvaluationSummary }) {
  if (!summary.notes.length) return null;
  return (
    <div className="space-y-2">
      {summary.notes.map((note) => (
        <div
          key={note}
          className="flex items-start gap-2.5 rounded-[12px] border border-line-warn bg-warn-tint px-4 py-3 text-[12.5px] leading-relaxed text-warn"
        >
          <TriangleAlert className="mt-[1px] size-4 shrink-0" />
          <p>{note}</p>
        </div>
      ))}
    </div>
  );
}

