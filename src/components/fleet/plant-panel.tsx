"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, TriangleAlert } from "lucide-react";
import { useDaily, useSeries, useSummary } from "@/lib/api/queries";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { BandBars } from "@/components/evidence/band-bars";
import { ModelLogo } from "@/components/brand/model-logo";
import { MetricTooltip } from "@/components/metrics/metric-tooltip";
import { Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/states";
import { ACTUAL_COLOR, MODELS, MODEL_IDS, TOLERANCE_COLOR } from "@/lib/config/models";
import { normalizeModel } from "@/lib/metrics/normalize";
import type { MetricKey, ModelId, PlantConfig } from "@/lib/types";
import type { ScenarioId } from "@/lib/mock/scenarios";
import { formatInt, formatMetric, formatPct } from "@/lib/utils/format";
import { METRIC_CATALOG } from "@/lib/config/metric-catalog";
import { formatRange } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

/* Money first, then error, then compliance. The DSM figure is the one a
   commercial reader looks for, so it leads rather than trailing the accuracy
   metrics it is derived from. */
const HEADLINE: { metric: MetricKey; label: string }[] = [
  { metric: "estimated_dsm_impact_pct", label: "Lowest DSM %" },
  { metric: "rmse_mw", label: "Best RMSE" },
  { metric: "band_a_pct", label: "Best Band A" },
  { metric: "mae_mw", label: "Best MAE" },
];

/**
 * One plant's readout on the fleet overview: the metric winners, the forecast
 * evidence beside its band outcome, and the way through to the full monitor.
 *
 * Each panel owns its own queries so a slow or failing plant never blocks the
 * rest of the fleet from rendering.
 *
 * Styling here uses the page-scoped `fx-` treatment — see globals.css.
 */
export function PlantPanel({
  plant,
  from,
  to,
  scenario,
}: {
  plant: PlantConfig;
  from: string;
  to: string;
  scenario: ScenarioId;
}) {
  const router = useRouter();
  const scope = { plantId: plant.id, from, to, scenario };
  const summary = useSummary(scope);
  const series = useSeries(scope);
  const daily = useDaily(scope);
  const multiDay = from !== to;
  const [showBands, setShowBands] = useState(false);

  /* What the asset actually did, alongside how well it was predicted. Error
     statistics on their own leave a reader with no sense of the plant. */
  const output = daily.data
    ? daily.data.days.reduce(
        (acc, d) => ({
          energy: acc.energy + (d.energy_mwh ?? 0),
          peak: Math.max(acc.peak, d.peak_actual_mw ?? 0),
        }),
        { energy: 0, peak: 0 },
      )
    : null;

  /* A fleet panel is a way in, not a dead end: the chart pans and zooms like the
     monitor's, and picking a day opens that plant's 96-block detail directly. */
  function openDay(date: string) {
    router.push(
      `/monitor?plant=${plant.id}&date=${date}&from=${from}&to=${to}&scenario=${scenario}`,
    );
  }

  const monitorHref = `/monitor?plant=${plant.id}&from=${from}&to=${to}&scenario=${scenario}`;
  const coverage = summary.data?.coverage;
  const degraded = coverage ? coverage.coverage_pct < 99.5 || !coverage.like_for_like : false;

  return (
    <article className="fx-panel fx-rail @container/panel relative overflow-hidden">
      {/* Registration marks and a single arrival sweep. Decoration with a job:
          they read as an instrument taking a reading, not as ornament. */}
      <span aria-hidden="true" className="fx-corners">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span aria-hidden="true" className="fx-sweep" />

      {/* Identity */}
      <header className="relative z-[3] px-4 pt-3.5 pb-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-baseline gap-2.5">
            <h2 className="text-[18px] leading-none font-semibold tracking-[-0.022em] text-ink">
              {plant.name}
            </h2>
            <span className="fx-figure text-[12px] text-ink-3">
              {plant.capacity_mw} MW
            </span>
            <span className="text-[11px] tracking-[0.1em] text-ink-4 uppercase">
              {plant.state}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {summary.data ? <NormalisedLeader plant={plant} summary={summary.data} /> : null}
            <Link
              href={monitorHref}
              className="group inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-800 pr-3 pl-3.5 text-[12px] font-medium text-white transition-colors hover:bg-brand-700"
            >
              Open monitor
              <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        <dl className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-ink-4">
            <Fact label="Period" value={formatRange(from, to)} />
            <Sep />
            <Fact label="Band A" value={`±${plant.visual_tolerance_pct}% of Actual`} />
            <Sep />
            <Fact
              label="Bands"
              value={`${plant.official_bands[0]}–${plant.official_bands[plant.official_bands.length - 1]}`}
            />
            <Sep />
            <div className="flex items-baseline gap-1.5">
              <dt className="text-[9.5px] tracking-[0.14em] text-ink-4/80 uppercase">
                Status
              </dt>
              <dd className="flex items-center gap-1.5">
                <span
                  className="fx-led translate-y-[1px]"
                  style={
                    {
                      "--fx-led": degraded
                        ? "var(--color-accent-500)"
                        : "var(--color-brand-500)",
                    } as React.CSSProperties
                  }
                />
                <span
                  className={cn(
                    "fx-figure text-[11.5px]",
                    degraded ? "text-warn" : "text-brand-600",
                  )}
                >
                  {degraded ? "Attention" : "Nominal"}
                </span>
              </dd>
            </div>
            {output ? (
              <>
                <Sep />
                <Fact label="Generated" value={`${formatInt(Math.round(output.energy))} MWh`} />
                <Sep />
                <Fact label="Peak" value={`${output.peak.toFixed(1)} MW`} />
              </>
            ) : null}
        </dl>
      </header>

      {summary.isError ? (
        <div className="px-4 pb-5">
          <ErrorState error={summary.error} onRetry={() => summary.refetch()} compact />
        </div>
      ) : (
        <>
          {/* Winners + coverage */}
          <div className="grid grid-cols-2 border-y border-line-soft @[400px]/panel:grid-cols-3 @[600px]/panel:grid-cols-5">
            {HEADLINE.map((card) => {
              const winnerId = summary.data?.winners[card.metric] ?? null;
              const model = summary.data?.models.find((m) => m.model === winnerId);
              const value = model ? (model[card.metric] as number | null) : null;

              /* Band A reads as a count, not a share. "390/424 blocks" is the
                 thing a reader can check against the block table; a percentage
                 is a derived figure they would have to trust. */
              const isBandA = card.metric === "band_a_pct";
              const bandABlocks =
                isBandA && model && coverage
                  ? `${formatInt(model.band_counts.A ?? 0)}/${formatInt(coverage.eligible_intervals)}`
                  : null;

              return (
                <Tile
                  key={card.metric}
                  label={card.label}
                  pending={summary.isPending}
                  metric={card.metric}
                  evaluated={model?.evaluated_intervals}
                  value={
                    bandABlocks ?? (value === null ? "—" : formatMetric(card.metric, value))
                  }
                  caption={isBandA && value !== null ? `${formatPct(value)} of eligible` : undefined}
                  winner={winnerId}
                  margin={
                    summary.data ? marginOverRunnerUp(summary.data, card.metric) : null
                  }
                />
              );
            })}
            <Tile
              label="Actual coverage"
              pending={summary.isPending}
              metric="coverage"
              value={coverage ? formatPct(coverage.coverage_pct) : "—"}
              caption={
                coverage ? `${formatInt(coverage.eligible_intervals)} eligible blocks` : "—"
              }
              warn={coverage ? coverage.coverage_pct < 99.5 : false}
              fill={coverage ? coverage.coverage_pct : null}
            />
          </div>


          {/* The curve gets the full panel width — at two panels per row that
              is about half the page, which is the narrowest a day's shape stays
              readable at. The band outcome moves beneath it, folded away by
              default: it answers a follow-up question, not the first one. */}
          <div>
            <section className="px-4 pt-3.5 pb-1.5">
              <p className="fx-rule-label mb-1.5">Forecast vs Actual</p>
              {series.isPending || !series.data ? (
                <Skeleton className="h-[216px]" />
              ) : (
                <ForecastChart
                  intervals={series.data.intervals}
                  plant={plant}
                  visibleModels={[...MODEL_IDS]}
                  resolution={series.data.resolution}
                  isSingleDay={!multiDay}
                  markBreaches
                  compact
                  showZoom={multiDay}
                  onDayClick={multiDay ? openDay : () => openDay(from)}
                  bandBasis={summary.data?.models[0]?.band_basis}
                  height={216}
                />
              )}
            </section>

            <section className="border-t border-line-soft">
              <button
                onClick={() => setShowBands((v) => !v)}
                aria-expanded={showBands}
                className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-surface-sunken"
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-ink-4 transition-transform duration-200",
                    showBands && "rotate-180",
                  )}
                />
                <span className="fx-rule-label">Band outcome</span>
                <span className="ml-auto text-[11px] text-ink-4">
                  {showBands ? "Hide" : "Show"}
                </span>
              </button>
              {showBands ? (
                <div className="px-4 pb-2">
                  {summary.isPending || !summary.data ? (
                    <Skeleton className="h-[216px]" />
                  ) : (
                    <BandBars summary={summary.data} height={216} compact />
                  )}
                </div>
              ) : null}
            </section>
          </div>

          {/* Legend */}
          <footer className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line-soft bg-surface-muted px-4 py-2">
            <MiniLegend tolerancePct={plant.visual_tolerance_pct} />
            <span className="ml-auto text-[11px] text-ink-4">
              {multiDay
                ? "Scroll to zoom · click a day for its 96 blocks"
                : "Click the chart for the 96-block detail"}
            </span>
          </footer>

          {summary.data && !summary.data.coverage.like_for_like ? (
            <div className="flex items-start gap-2 border-t border-line-warn bg-warn-tint px-6 py-2.5 text-[11.5px] leading-snug text-warn">
              <TriangleAlert className="mt-[1px] size-3.5 shrink-0" />
              Model feeds cover different intervals here — not a like-for-like comparison.
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------- */

function Fact({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-[9.5px] tracking-[0.14em] text-ink-4/80 uppercase">{label}</dt>
      <dd
        className={cn(
          "fx-figure text-[11.5px]",
          tone === "warn" ? "text-warn" : tone === "ok" ? "text-brand-600" : "text-ink-2",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Sep() {
  return <span aria-hidden="true" className="h-2.5 w-px bg-line" />;
}

function Tile({
  label,
  value,
  caption,
  winner,
  margin,
  fill,
  pending,
  warn,
  metric,
  evaluated,
}: {
  label: string;
  value: string;
  caption?: string;
  /** Winning model — drives the tile's accent hairline and its brand mark. */
  winner?: ModelId | null;
  /** Formatted lead over the runner-up, when there is one. */
  margin?: string | null;
  /** 0–100 value to draw as a meter beneath the figure. */
  fill?: number | null;
  pending?: boolean;
  warn?: boolean;
  metric: string;
  evaluated?: number;
}) {
  const meta = winner ? MODELS[winner] : null;

  return (
    <MetricTooltip metric={metric} value={value} evaluatedIntervals={evaluated} side="bottom">
      <div
        className="fx-tile min-w-0 cursor-help px-3 py-2.5"
        style={meta ? ({ "--fx-accent": meta.color } as React.CSSProperties) : undefined}
      >
        <p className="min-h-[2.2em] text-[9px] leading-[1.3] font-semibold tracking-[0.1em] text-ink-4 uppercase">
          {label}
        </p>

        {pending ? (
          <Skeleton className="mt-1.5 h-5 w-16" />
        ) : (
          <div className="mt-1">
            <span
              className={cn(
                "fx-figure block truncate text-[18px] leading-none @[900px]/panel:text-[21px]",
                warn ? "text-warn" : "text-ink",
              )}
            >
              {value}
            </span>
            {margin ? (
              <span className="fx-figure mt-1 block truncate text-[9.5px] text-ink-4">
                {margin} clear
              </span>
            ) : null}
          </div>
        )}

        {typeof fill === "number" ? (
          <span className="mt-2 block h-[3px] w-full overflow-hidden rounded-full bg-line-soft">
            <span
              className="block h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${Math.max(2, Math.min(100, fill))}%`,
                backgroundColor: warn ? "var(--color-accent-500)" : "var(--color-brand-500)",
              }}
            />
          </span>
        ) : null}

        <div className="mt-1.5 flex h-4 min-w-0 items-center gap-1.5 overflow-hidden text-[10px] whitespace-nowrap text-ink-3">
          {meta ? (
            <>
              {meta.brand ? (
                <ModelLogo model={meta.id} height={11} />
              ) : (
                <span
                  aria-hidden="true"
                  className="h-2.5 w-[3px] shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
              )}
              <span className="truncate">{meta.name}</span>
            </>
          ) : (
            <span className="truncate">{caption ?? "not available"}</span>
          )}
        </div>
      </div>
    </MetricTooltip>
  );
}

function MiniLegend({ tolerancePct }: { tolerancePct: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
      <span className="flex items-center gap-1.5 text-[10.5px] tracking-[0.06em] text-ink-3 uppercase">
        <span className="h-[2px] w-4 rounded-full" style={{ backgroundColor: ACTUAL_COLOR }} />
        Actual
      </span>
      <span className="flex items-center gap-1.5 text-[10.5px] tracking-[0.06em] text-ink-3 uppercase">
        <span
          className="h-3 w-4 rounded-[2px]"
          style={{
            backgroundColor: `${TOLERANCE_COLOR}40`,
            border: `1px solid ${TOLERANCE_COLOR}80`,
          }}
        />
        Band A ±{tolerancePct}%
      </span>
      {MODEL_IDS.map((id) => (
        <span
          key={id}
          className="flex items-center gap-1.5 text-[10.5px] tracking-[0.06em] text-ink-3 uppercase"
        >
          <span
            className="h-[2px] w-4 rounded-full"
            style={{ backgroundColor: MODELS[id].color }}
          />
          {MODELS[id].shortName}
        </span>
      ))}
    </div>
  );
}

/** Capacity-normalised leader — the only figure comparable between plants. */
function NormalisedLeader({
  plant,
  summary,
}: {
  plant: PlantConfig;
  summary: NonNullable<ReturnType<typeof useSummary>["data"]>;
}) {
  let bestId: ModelId | null = null;
  let bestValue = Number.POSITIVE_INFINITY;
  for (const model of summary.models) {
    const n = normalizeModel(model, plant).nrmse_pct;
    if (n < bestValue) {
      bestValue = n;
      bestId = model.model;
    }
  }
  if (!bestId) return null;

  return (
    <MetricTooltip
      metric="nrmse_pct"
      value={`${bestValue.toFixed(1)}%`}
      evaluatedIntervals={summary.coverage.eligible_intervals}
      side="bottom"
    >
      <span className="hidden cursor-help items-center gap-2 rounded-full border border-line bg-surface-sunken py-1.5 pr-3 pl-2.5 sm:flex">
        <span className="text-[9.5px] leading-none font-semibold tracking-[0.14em] text-ink-4 uppercase">
          NRMSE lead
        </span>
        <span
          aria-hidden="true"
          className="h-2.5 w-[3px] rounded-full"
          style={{ backgroundColor: MODELS[bestId].color }}
        />
        <span className="fx-figure text-[12px] text-ink">
          {MODELS[bestId].shortName} {bestValue.toFixed(1)}%
        </span>
      </span>
    </MetricTooltip>
  );
}

/** Lead of the metric's winner over the next-best model, ready to render. */
function marginOverRunnerUp(
  summary: NonNullable<ReturnType<typeof useSummary>["data"]>,
  metric: MetricKey,
): string | null {
  const winnerId = summary.winners[metric];
  if (!winnerId) return null;
  const winner = summary.models.find((m) => m.model === winnerId);
  const value = winner ? (winner[metric] as number | null) : null;
  if (value === null || value === undefined) return null;

  const others = summary.models
    .filter((m) => m.model !== winnerId)
    .map((m) => m[metric] as number | null)
    .filter((v): v is number => v !== null);
  if (!others.length) return null;

  const dir = METRIC_CATALOG[metric].direction;
  const runnerUp = dir === "higher" ? Math.max(...others) : Math.min(...others);
  const margin = Math.abs(value - runnerUp);

  /* A lead is only worth printing if it survives the precision it is printed
     at. "+0.0pp clear" claims a gap where the two models effectively tied. */
  if (metric.endsWith("_pct")) {
    return margin >= 0.05 ? `+${margin.toFixed(1)}pp` : null;
  }
  return margin >= 0.0005 ? `+${margin.toFixed(3)}` : null;
}
