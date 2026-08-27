"use client";

import { MODELS, MODEL_IDS } from "@/lib/config/models";
import { DSM_BASIS_TEXT } from "@/lib/config/metric-catalog";
import { MetricTooltip } from "@/components/metrics/metric-tooltip";
import { Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import type { DsmComparison, DsmOutcome, ModelId } from "@/lib/types";
import { formatInr, formatInt } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** The models that could replace the QCA schedule, which is the baseline. */
const ALTERNATIVES = MODEL_IDS.filter((id) => id !== "external_qca");

/**
 * One plant's cost of deviation, for the scope currently on screen.
 *
 * Laid out across rather than down so it costs one band of height. Every figure
 * comes from the payload's `dsm` block, priced by the same routine for the
 * schedule and both alternatives, so no tile can be measured on a different
 * basis from its neighbours.
 */
export function DsmStrip({
  dsm,
  eligibleIntervals,
  scopeLabel,
  isPending,
}: {
  dsm?: DsmComparison;
  eligibleIntervals?: number;
  /** "11–18 Aug 2026" or "Tue 12 Aug" — whichever scope produced these figures. */
  scopeLabel: string;
  isPending?: boolean;
}) {
  const simulated = dsm?.basis === "simulated_model_attribution";

  /* The QCA feed is what gets submitted, so the baseline and the QCA
     counterfactual are the same number. One tile carries both, and "cheapest"
     is contested only among the alternatives that could replace it. */
  const cheapest = dsm
    ? ALTERNATIVES.reduce<{ id: ModelId; penalty: number } | null>((best, id) => {
        const o = dsm.counterfactual[id];
        if (!o) return best;
        return best === null || o.penalty_inr < best.penalty ? { id, penalty: o.penalty_inr } : best;
      }, null)
    : null;

  const baseline = dsm?.counterfactual.external_qca ?? dsm?.as_scheduled ?? null;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Cost of deviation"
        subtitle={`What settlement costs over ${scopeLabel} on the QCA schedule, and what it would have cost had each alternative been submitted instead`}
      />

      {isPending || !dsm ? (
        <div className="grid gap-2 px-5 pb-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[92px] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2 px-5 pb-4 sm:grid-cols-3">
          <Tile
            label="Scheduled / QCA"
            outcome={baseline}
            baseline={null}
            color={MODELS.external_qca.color}
            note="as submitted today"
          />
          {ALTERNATIVES.map((id) => (
            <Tile
              key={id}
              label={MODELS[id].name}
              outcome={dsm.counterfactual[id] ?? null}
              baseline={baseline}
              color={MODELS[id].color}
              best={cheapest?.id === id}
            />
          ))}
        </div>
      )}

      <div className="space-y-1 border-t border-line bg-surface-muted px-5 py-3">
        <p className="text-[11.5px] leading-relaxed text-ink-3">
          Priced at ₹{dsm ? dsm.tariff_inr_per_kwh.toFixed(2) : "—"}/kWh
          {eligibleIntervals !== undefined
            ? ` across ${formatInt(eligibleIntervals)} eligible blocks`
            : ""}
          . Revenue is generated energy at the same tariff, so the percentage is penalty against
          what the plant earned over exactly those blocks.
        </p>
        {dsm ? (
          <p className="text-[11.5px] leading-relaxed text-ink-4">
            {simulated
              ? DSM_BASIS_TEXT.simulated_model_attribution.text
              : DSM_BASIS_TEXT.actual_schedule_linked.text}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function Tile({
  label,
  outcome,
  baseline,
  color,
  best,
  note,
}: {
  label: string;
  outcome: DsmOutcome | null;
  /** Null on the baseline tile itself. */
  baseline: DsmOutcome | null;
  color: string;
  best?: boolean;
  note?: string;
}) {
  const delta = outcome && baseline ? outcome.penalty_inr - baseline.penalty_inr : null;
  const better = delta !== null && delta < 0;

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface px-3.5 py-3",
        best ? "border-brand-200 bg-brand-50/40" : "border-line",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-3 w-[3px] shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate text-[11.5px] font-medium text-ink-2">{label}</span>
        {best ? (
          <span className="ml-auto shrink-0 rounded-md bg-brand-50 px-1.5 py-[2px] text-[9px] font-bold tracking-wide text-brand-700 uppercase ring-1 ring-brand-200 ring-inset">
            Cheapest
          </span>
        ) : null}
      </div>

      <MetricTooltip
        metric="estimated_dsm_impact_pct"
        value={outcome ? `${outcome.pct_of_revenue.toFixed(2)}%` : "—"}
        dsmBasis={null}
        extra={
          outcome ? (
            <>
              {formatInr(outcome.penalty_inr)} penalty on {formatInr(outcome.revenue_inr)} of energy
              revenue, from {outcome.energy_mwh.toFixed(1)} MWh generated.
            </>
          ) : undefined
        }
      >
        <div className="mt-2 cursor-help">
          <span className="readout block text-[21px] leading-none font-semibold text-ink">
            {outcome ? formatInr(outcome.penalty_inr) : "—"}
          </span>
          <span className="tnum mt-1.5 block text-[11.5px] text-ink-3">
            {outcome ? `${outcome.pct_of_revenue.toFixed(2)}% of revenue` : "no eligible blocks"}
          </span>
        </div>
      </MetricTooltip>

      <span
        className={cn(
          "tnum mt-1.5 block text-[10.5px]",
          better ? "text-brand-600" : delta !== null && delta > 0 ? "text-warn" : "text-ink-4",
        )}
      >
        {note
          ? note
          : delta === null
            ? ""
            : Math.round(delta) === 0
              ? "same as scheduled"
              : `${better ? "saves " : "costs "}${formatInr(Math.abs(delta))}`}
      </span>
    </div>
  );
}
