"use client";

import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queries";
import { PLANT_LIST } from "@/lib/config/plants";
import { MODELS, MODEL_IDS } from "@/lib/config/models";
import { METRIC_CATALOG } from "@/lib/config/metric-catalog";
import { normalizeModel } from "@/lib/metrics/normalize";
import { MetricTooltip } from "@/components/metrics/metric-tooltip";
import { Skeleton } from "@/components/ui/primitives";
import type { EvaluationSummary, MetricKey, ModelId } from "@/lib/types";
import type { ScenarioId } from "@/lib/mock/scenarios";
import { formatMetric } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/* Accuracy and compliance only. DSM has its own panel alongside this one, where
   it can be shown in money against the schedule that was actually submitted —
   a chip in a grid could not carry that, and repeating it here just crowded the
   columns until the table no longer fit its half of the row. */
const COLUMNS: { metric: MetricKey; label: string }[] = [
  { metric: "rmse_mw", label: "RMSE" },
  { metric: "mae_mw", label: "MAE" },
  { metric: "band_a_pct", label: "Band A" },
  { metric: "estimated_dsm_impact_pct", label: "DSM" },
];

/**
 * Who won what, where.
 *
 * This is the first question a stakeholder asks, and the honest answer is a grid
 * rather than a number: one winner per metric per plant. Deliberately *not* a
 * fleet score — the tally at the foot counts cells won, and says so, so it can
 * never be mistaken for a composite ranking (PRD §8).
 */
export function FleetScoreboard({
  from,
  to,
  scenario,
}: {
  from: string;
  to: string;
  scenario: ScenarioId;
}) {
  // One query per plant, sharing the panels' cache entries exactly.
  const results = useQueries({
    queries: PLANT_LIST.map((plant) => {
      const scope = { plantId: plant.id, from, to, scenario };
      return { queryKey: queryKeys.summary(scope), queryFn: () => api.summary(scope) };
    }),
  });

  const pending = results.some((r) => r.isPending);
  const summaries = results.map((r) => r.data);

  // Cells won per model, across every plant and metric shown here.
  const tally = new Map<ModelId, number>(MODEL_IDS.map((id) => [id, 0]));
  for (const summary of summaries) {
    if (!summary) continue;
    for (const col of COLUMNS) {
      const winner = summary.winners[col.metric];
      if (winner) tally.set(winner, (tally.get(winner) ?? 0) + 1);
    }
  }
  const totalCells = summaries.filter(Boolean).length * COLUMNS.length;

  return (
    <section className="fx-panel relative overflow-hidden">
      <span aria-hidden="true" className="fx-corners">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span aria-hidden="true" className="fx-sweep" />

      <header className="relative z-[3] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5 px-6 pt-5 pb-4">
        <div>
          <p className="fx-rule-label">Who won what</p>
          <p className="mt-2.5 max-w-[60ch] text-[12.5px] leading-relaxed text-ink-3">
            One winner per metric, per plant. A model can lead on error and trail on band
            compliance — that is the point of reading it this way.
          </p>
        </div>
        <p className="text-[11px] text-ink-4">
          {totalCells > 0 ? `${totalCells} independent contests` : null}
        </p>
      </header>

      <div className="scrollbar-slim overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-y border-line-soft bg-surface-muted">
              <th className="px-6 py-2.5 text-left text-[9.5px] font-semibold tracking-[0.16em] text-ink-4 uppercase">
                Plant
              </th>
              {COLUMNS.map((col) => (
                <th key={col.metric} className="px-2 py-2 text-left">
                  <MetricTooltip metric={col.metric}>
                    <span className="cursor-help text-[9.5px] font-semibold tracking-[0.16em] text-ink-4 uppercase">
                      {col.label}
                    </span>
                  </MetricTooltip>
                </th>
              ))}
              <th className="px-3 py-2 text-right text-[9px] font-semibold tracking-[0.12em] text-ink-4 uppercase">
                NRMSE lead
              </th>
            </tr>
          </thead>
          <tbody>
            {PLANT_LIST.map((plant, i) => {
              const summary = summaries[i];
              return (
                <tr key={plant.id} className="border-b border-line-soft last:border-0">
                  <th scope="row" className="px-3 py-2.5 text-left">
                    <span className="block text-[12.5px] font-semibold tracking-[-0.01em] whitespace-nowrap text-ink">
                      {plant.name}
                    </span>
                    <span className="fx-figure mt-0.5 block text-[10px] whitespace-nowrap text-ink-4">
                      {plant.capacity_mw} MW · {plant.state_short} · ±
                      {plant.visual_tolerance_pct}%
                    </span>
                  </th>

                  {COLUMNS.map((col) => (
                    <td key={col.metric} className="px-2 py-2.5">
                      {pending || !summary ? (
                        <Skeleton className="h-6 w-24 rounded-full" />
                      ) : (
                        <WinnerChip summary={summary} metric={col.metric} />
                      )}
                    </td>
                  ))}

                  <td className="px-6 py-3 text-right">
                    {pending || !summary ? (
                      <Skeleton className="ml-auto h-6 w-20 rounded-full" />
                    ) : (
                      <NrmseLead summary={summary} plantIndex={i} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-soft bg-surface-muted px-6 py-3">
        <span className="text-[9.5px] font-semibold tracking-[0.16em] text-ink-4 uppercase">
          Contests won
        </span>
        {MODEL_IDS.map((id) => {
          const won = tally.get(id) ?? 0;
          return (
            <span key={id} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-3 w-[3px] rounded-full"
                style={{ backgroundColor: MODELS[id].color }}
              />
              <span className="text-[11.5px] text-ink-2">{MODELS[id].shortName}</span>
              <span className="fx-figure text-[13px] text-ink">
                {pending ? "–" : won}
              </span>
            </span>
          );
        })}
        <span className="ml-auto max-w-[46ch] text-[11px] leading-snug text-ink-4">
          A count of cells above, not a score. Metrics are not weighted against each other.
        </span>
      </footer>
    </section>
  );
}

function WinnerChip({
  summary,
  metric,
}: {
  summary: EvaluationSummary;
  metric: MetricKey;
}) {
  const winnerId = summary.winners[metric] ?? null;
  if (!winnerId) {
    return <span className="text-[12px] text-ink-4">—</span>;
  }

  const meta = MODELS[winnerId];
  const model = summary.models.find((m) => m.model === winnerId);
  const value = model ? (model[metric] as number | null) : null;

  // Margin over the runner-up: what makes a win worth reading.
  const dir = METRIC_CATALOG[metric].direction;
  const others = summary.models
    .filter((m) => m.model !== winnerId)
    .map((m) => m[metric] as number | null)
    .filter((v): v is number => v !== null);
  const runnerUp =
    others.length && value !== null
      ? dir === "higher"
        ? Math.max(...others)
        : Math.min(...others)
      : null;
  const rawMargin = runnerUp !== null && value !== null ? Math.abs(value - runnerUp) : null;
  /* A lead is only worth printing if it survives the precision we print it at.
     "+0.0pp clear" reads as a claim where the two models actually tied. */
  const marginText =
    rawMargin === null
      ? null
      : metric.endsWith("_pct")
        ? rawMargin >= 0.05
          ? `+${rawMargin.toFixed(1)}pp clear`
          : null
        : rawMargin >= 0.0005
          ? `+${rawMargin.toFixed(3)} clear`
          : null;

  return (
    <MetricTooltip
      metric={metric}
      value={formatMetric(metric, value)}
      evaluatedIntervals={model?.evaluated_intervals}
      dsmBasis={metric === "estimated_dsm_impact_pct" ? model?.dsm_basis : null}
      bandBasis={metric === "band_a_pct" ? model?.band_basis : null}
    >
      {/* The margin sits under the pill, not inside it. On one line each column
          ran ~46px wider than the half-row this table now occupies, and the
          table scrolled inside itself at 1600px. */}
      <span className="inline-flex cursor-help flex-col items-start gap-1">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border py-[3px] pr-2 pl-1.5"
          style={{ borderColor: `${meta.color}33`, backgroundColor: `${meta.color}0f` }}
        >
          <span
            aria-hidden="true"
            className="h-3 w-[3px] shrink-0 rounded-full"
            style={{ backgroundColor: meta.color }}
          />
          <span className="text-[11px] font-medium whitespace-nowrap text-ink">
            {meta.shortName}
          </span>
          <span className="fx-figure text-[11px] whitespace-nowrap text-ink-2">
            {formatMetric(metric, value)}
          </span>
        </span>
        {marginText ? (
          <span className="fx-figure pl-1.5 text-[9.5px] whitespace-nowrap text-ink-4">
            {marginText}
          </span>
        ) : (
          <span className="pl-1.5 text-[9.5px] whitespace-nowrap text-ink-4">too close to call</span>
        )}
      </span>
    </MetricTooltip>
  );
}

/** The only figure comparable between plants of different size. */
function NrmseLead({
  summary,
  plantIndex,
}: {
  summary: EvaluationSummary;
  plantIndex: number;
}) {
  const plant = PLANT_LIST[plantIndex];
  let bestId: ModelId | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const model of summary.models) {
    const n = normalizeModel(model, plant).nrmse_pct;
    if (n < best) {
      best = n;
      bestId = model.model;
    }
  }
  if (!bestId) return <span className="text-[12px] text-ink-4">—</span>;

  return (
    <MetricTooltip
      metric="nrmse_pct"
      value={`${best.toFixed(1)}%`}
      evaluatedIntervals={summary.coverage.eligible_intervals}
    >
      <span className={cn("inline-flex cursor-help items-center gap-2")}>
        <span
          aria-hidden="true"
          className="h-3 w-[3px] rounded-full"
          style={{ backgroundColor: MODELS[bestId].color }}
        />
        <span className="fx-figure text-[12.5px] text-ink">
          {MODELS[bestId].shortName} {best.toFixed(1)}%
        </span>
      </span>
    </MetricTooltip>
  );
}
