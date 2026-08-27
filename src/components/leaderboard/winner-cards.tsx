"use client";

import { motion } from "motion/react";
import { Activity, BarChart3, IndianRupee, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MODELS } from "@/lib/config/models";
import { METRIC_CATALOG } from "@/lib/config/metric-catalog";
import type { EvaluationSummary, MetricKey, ModelId } from "@/lib/types";
import { MetricTooltip } from "@/components/metrics/metric-tooltip";
import { DirectionArrow, ModelDot, Skeleton } from "@/components/ui/primitives";
import { formatMetric } from "@/lib/utils/format";

/* Money first, matching the fleet panels: the DSM figure is what a commercial
   reader looks for, and it leads rather than trailing the accuracy metrics it
   is derived from. */
const CARDS: { metric: MetricKey; title: string; icon: LucideIcon }[] = [
  { metric: "estimated_dsm_impact_pct", title: "Lowest DSM %", icon: IndianRupee },
  { metric: "rmse_mw", title: "Best RMSE", icon: Activity },
  { metric: "band_a_pct", title: "Best Band A", icon: ShieldCheck },
  { metric: "mae_mw", title: "Best MAE", icon: BarChart3 },
];

/**
 * Four independent winners. There is deliberately no fifth "overall" card —
 * a model may legitimately win one metric and lose another (PRD §8).
 */
export function WinnerCards({
  summary,
  isPending,
}: {
  summary?: EvaluationSummary;
  isPending?: boolean;
}) {
  if (isPending || !summary) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => (
          <Skeleton key={c.metric} className="h-[112px] rounded-[14px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((card, i) => {
        const winnerId = summary.winners[card.metric] ?? null;
        const model = summary.models.find((m) => m.model === winnerId);
        const def = METRIC_CATALOG[card.metric];
        const value = model ? (model[card.metric] as number | null) : null;

        // The margin over the runner-up is what makes a "win" meaningful.
        const others = summary.models
          .filter((m) => m.model !== winnerId)
          .map((m) => m[card.metric] as number | null)
          .filter((v): v is number => v !== null);
        const runnerUp =
          others.length && value !== null
            ? def.direction === "higher"
              ? Math.max(...others)
              : Math.min(...others)
            : null;
        const margin =
          runnerUp !== null && value !== null ? Math.abs(value - runnerUp) : null;

        return (
          <motion.div
            key={card.metric}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: i * 0.045, ease: [0.22, 1, 0.36, 1] }}
          >
            <WinnerCard
              title={card.title}
              icon={card.icon}
              metric={card.metric}
              winnerId={winnerId}
              value={value}
              margin={margin}
              evaluated={model?.evaluated_intervals}
              dsmBasis={card.metric === "estimated_dsm_impact_pct" ? model?.dsm_basis : null}
              bandBasis={card.metric === "band_a_pct" ? model?.band_basis : null}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function WinnerCard({
  title,
  icon: Icon,
  metric,
  winnerId,
  value,
  margin,
  evaluated,
  dsmBasis,
  bandBasis,
}: {
  title: string;
  icon: LucideIcon;
  metric: MetricKey;
  winnerId: ModelId | null;
  value: number | null;
  margin: number | null;
  evaluated?: number;
  dsmBasis?: "actual_schedule_linked" | "simulated_model_attribution" | null;
  bandBasis?: "regulatory_schedule" | "simulated_model_as_schedule" | null;
}) {
  const def = METRIC_CATALOG[metric];
  const model = winnerId ? MODELS[winnerId] : null;

  return (
    <div className="card group relative h-full overflow-hidden px-4 pt-3.5 pb-4">
      {/* Winner's identity colour as a hairline, not a fill. */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundColor: model?.color ?? "var(--color-line)" }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] leading-none font-semibold tracking-[0.06em] text-ink-4 uppercase">
            {title}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            {model ? <ModelDot color={model.color} size={8} /> : null}
            <p className="truncate text-[14px] leading-none font-semibold tracking-[-0.01em] text-ink">
              {model?.name ?? "Not available"}
            </p>
          </div>
        </div>
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-sunken text-ink-4 transition-colors group-hover:bg-tint group-hover:text-hud">
          <Icon className="size-3.5" strokeWidth={2.2} />
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <MetricTooltip
          metric={metric}
          value={formatMetric(metric, value)}
          evaluatedIntervals={evaluated}
          dsmBasis={dsmBasis}
          bandBasis={bandBasis}
        >
          <div className="cursor-help">
            <span className="metric-value text-[27px] leading-none font-semibold tracking-[-0.03em] text-ink">
              {value === null ? "—" : formatMetric(metric, value).replace("%", "")}
            </span>
            <span className="ml-1 text-[13px] font-medium text-ink-3">
              {def.unit === "%" ? "%" : def.unit}
            </span>
          </div>
        </MetricTooltip>

        {margin !== null && margin > 0 ? (
          <span
            className="tnum mb-[3px] text-[11px] whitespace-nowrap text-ink-4"
            title="Margin over the next best model"
          >
            +{formatMargin(metric, margin)} clear
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 border-t border-line-soft pt-2.5">
        <DirectionArrow direction={def.direction} />
        <span className="text-[11px] text-ink-4">
          {def.direction === "higher" ? "Higher is better" : "Lower is better"}
        </span>
        {dsmBasis === "simulated_model_attribution" ? (
          <span className="ml-auto rounded bg-warn-tint px-1.5 py-[2px] text-[10px] font-semibold text-warn">
            Simulated
          </span>
        ) : null}
      </div>
    </div>
  );
}

function formatMargin(metric: MetricKey, margin: number): string {
  if (metric.endsWith("_pct")) return `${margin.toFixed(1)} pp`;
  return `${margin.toFixed(3)}`;
}
