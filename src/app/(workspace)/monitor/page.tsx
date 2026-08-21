"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Rows3 } from "lucide-react";
import { useDaily, useDayDetail, useSeries, useSummary } from "@/lib/api/queries";
import { usePlant, useWorkspace } from "@/components/workspace/workspace-context";
import { WinnerCards } from "@/components/leaderboard/winner-cards";
import { CoverageNote, Leaderboard } from "@/components/leaderboard/leaderboard";
import { DsmStrip } from "@/components/dsm/dsm-strip";
import { ForecastPanel } from "@/components/charts/forecast-panel";
import { BandDistribution } from "@/components/evidence/band-distribution";
import { DailyEvidence } from "@/components/evidence/daily-evidence";
import { IntradayErrorProfile } from "@/components/evidence/intraday-error";
import { IntervalTable } from "@/components/day/interval-table";
import { ErrorState, StaleBanner } from "@/components/ui/states";
import { Button, Card } from "@/components/ui/primitives";
import type { EvaluationSummary, SeriesResponse } from "@/lib/types";
import { addDays, eachDay, clampDay, formatDayWithWeekday, formatRange } from "@/lib/utils/date";
import { formatInt } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** Sentinel for "the whole selected period" in the `date` query parameter. */
const ALL = "all";

/**
 * One plant, one page.
 *
 * This absorbed the old `/day` route. The two pages had grown a duplicate
 * metric table, a duplicate chart with its own model toggles and a duplicate
 * coverage readout, and the only thing Day detail genuinely owned was a scope
 * control and the block table — a control and a section, not a destination. The
 * scope strip below now does that work, and every section on the page reads
 * from whichever scope it selects.
 */
export default function PlantMonitorPage() {
  const params = useSearchParams();
  const router = useRouter();
  const plant = usePlant();
  const { scope, isSingleDay, from, to, visibleModels } = useWorkspace();

  const periodDays = useMemo(() => eachDay(from, to), [from, to]);
  const multiDay = periodDays.length > 1;

  /* A multi-day period defaults to the whole period rather than silently
     collapsing to one day. A single-day period resolves straight to that day. */
  const requested = params.get("date");
  const mode: "all" | "day" =
    requested === ALL ? "all" : requested ? "day" : multiDay ? "all" : "day";
  const activeDate = clampDay(
    requested && requested !== ALL ? requested : to,
    plant.data_from,
    plant.data_to,
  );
  const dayScoped = mode === "day";

  const summaryQuery = useSummary(scope);
  const seriesQuery = useSeries(scope);
  const dailyQuery = useDaily(scope);
  const dayQuery = useDayDetail(scope, activeDate, dayScoped);

  const [showBlocks, setShowBlocks] = useState(false);

  function select(date: string) {
    const next = new URLSearchParams(params.toString());
    next.set("date", date);
    router.replace(`/monitor?${next.toString()}`, { scroll: false });
  }

  // Stepping stays inside the selected period; the period is the user's scope.
  const index = periodDays.indexOf(activeDate);
  const canStepBack = multiDay ? index > 0 : activeDate > plant.data_from;
  const canStepOn = multiDay ? index >= 0 && index < periodDays.length - 1 : activeDate < plant.data_to;
  const step = (delta: number) =>
    select(
      multiDay
        ? periodDays[Math.min(periodDays.length - 1, Math.max(0, index + delta))]
        : addDays(activeDate, delta),
    );

  /* The scope's authoritative payload. If it fails, nothing below it can be
     trusted, so the whole surface reports the failure rather than half-filling. */
  const primary = dayScoped ? dayQuery : summaryQuery;
  if (primary.isError) {
    return (
      <div className="mx-auto max-w-[640px] py-10">
        <ErrorState error={primary.error} onRetry={() => primary.refetch()} />
      </div>
    );
  }

  /* Two adapters, so every child below keeps the prop contract it already had
     and none of them needs to know which scope produced the numbers. */
  const view: EvaluationSummary | undefined = dayScoped
    ? dayQuery.data && {
        plant,
        range: { from: activeDate, to: activeDate },
        coverage: dayQuery.data.coverage,
        models: dayQuery.data.models,
        winners: dayQuery.data.winners,
        dsm: dayQuery.data.dsm,
        generated_at: `${activeDate}T23:45:00+05:30`,
        stale: false,
        notes: [],
      }
    : summaryQuery.data;

  const chartSeries: SeriesResponse | undefined = dayScoped
    ? dayQuery.data && {
        plant,
        range: { from: activeDate, to: activeDate },
        resolution: "15min",
        intervals: dayQuery.data.intervals,
        coverage: dayQuery.data.coverage,
      }
    : seriesQuery.data;

  const pending = dayScoped ? dayQuery.isPending : summaryQuery.isPending;
  const chartPending = dayScoped ? dayQuery.isPending : seriesQuery.isPending;
  const singleDay = dayScoped || isSingleDay;
  const scopeLabel = dayScoped ? formatDayWithWeekday(activeDate) : formatRange(from, to);
  const intervals = chartSeries?.intervals;

  return (
    <div className="space-y-4">
      {view?.stale ? <StaleBanner generatedAt={view.generated_at} /> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Plant monitor</p>
          <h1 className="mt-2.5 flex flex-wrap items-baseline gap-x-3 text-[24px] leading-none font-semibold tracking-[-0.02em] text-ink">
            {plant.name}
            <span className="readout text-[14px] font-normal text-ink-3">{scopeLabel}</span>
            <span className="text-[12px] font-normal tracking-[0.1em] text-ink-4 uppercase">
              {plant.state} · {plant.capacity_mw} MW
            </span>
          </h1>
          <p className="mt-2.5 max-w-[78ch] text-[12.5px] leading-relaxed text-ink-3">
            {dayScoped
              ? "One plant-day at full 15-minute resolution. Every metric, cost and chart below covers this day only."
              : `Range-level metrics across every eligible interval in the period — ${formatInt(periodDays.length * 96)} blocks expected. Pick a day to narrow the whole page to it.`}
          </p>
        </div>

        {singleDay ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={!canStepBack} onClick={() => step(-1)}>
              <ChevronLeft className="size-3.5" />
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={!canStepOn} onClick={() => step(1)}>
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>

      {/* Scope — the control the old Day detail route existed to hold. */}
      {multiDay ? (
        <Card className="overflow-hidden">
          <div className="scrollbar-slim flex items-center gap-1.5 overflow-x-auto px-4 py-3">
            <span className="label mr-1 shrink-0">Scope</span>
            <ScopeTab
              label={`Whole period · ${periodDays.length} days`}
              active={mode === "all"}
              onClick={() => select(ALL)}
            />
            <span className="mx-1 h-5 w-px shrink-0 bg-line" />
            {periodDays.map((d) => (
              <ScopeTab
                key={d}
                label={formatDayWithWeekday(d)}
                active={dayScoped && d === activeDate}
                onClick={() => select(d)}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {/* 1 — independent metric winners */}
      <WinnerCards summary={view} isPending={pending} />

      {/* 2 — what the accuracy above was worth, before the chart that evidences it */}
      <DsmStrip
        dsm={view?.dsm}
        eligibleIntervals={view?.coverage.eligible_intervals}
        scopeLabel={scopeLabel}
        isPending={pending}
      />

      {/* 3 — the evidence */}
      {(dayScoped ? dayQuery.isError : seriesQuery.isError) ? (
        <ErrorState
          error={dayScoped ? dayQuery.error : seriesQuery.error}
          onRetry={() => (dayScoped ? dayQuery.refetch() : seriesQuery.refetch())}
          compact
        />
      ) : (
        <ForecastPanel
          series={chartSeries}
          plant={plant}
          isPending={chartPending}
          dayScope={dayScoped ? { date: activeDate, label: scopeLabel } : null}
        />
      )}

      {view ? <CoverageNote summary={view} /> : null}

      {/* 4 — the authoritative comparison table */}
      <Leaderboard summary={view} isPending={pending} />

      {/* 5 — supporting evidence */}
      <div className="grid gap-4 xl:grid-cols-2">
        <BandDistribution summary={view} isPending={pending} />
        {singleDay ? (
          <IntradayErrorProfile
            series={chartSeries}
            plant={plant}
            isPending={chartPending}
            visibleModels={visibleModels}
          />
        ) : dailyQuery.isError ? (
          <ErrorState error={dailyQuery.error} onRetry={() => dailyQuery.refetch()} compact />
        ) : (
          <DailyEvidence daily={dailyQuery.data} isPending={dailyQuery.isPending} />
        )}
      </div>

      {/* 6 — the blocks themselves.
          Held behind a click in period scope: a month of daylight blocks is
          ~1,700 rows, which is a real cost to mount on every visit to a plant
          for a table most visits never read. In day scope it is ~56 rows and
          the reason the reader narrowed, so it opens with the page. */}
      {intervals ? (
        dayScoped || showBlocks ? (
          <IntervalTable
            intervals={intervals}
            plant={plant}
            date={dayScoped ? activeDate : `${from}_${to}`}
          />
        ) : (
          <button
            onClick={() => setShowBlocks(true)}
            className="card flex w-full flex-wrap items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-sunken"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[3px] bg-tint text-hud ring-1 ring-line-hud">
              <Rows3 className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold tracking-[0.1em] text-ink uppercase">
                Block-by-block detail
              </span>
              <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-3">
                Every 15-minute block across {periodDays.length} days, with per-model deviation and
                band. Pick a single day above to narrow it.
              </span>
            </span>
            <span className="inline-flex h-9 shrink-0 items-center rounded-lg border border-line-strong bg-surface px-3.5 text-[12.5px] font-medium text-ink">
              Show blocks
            </span>
          </button>
        )
      ) : null}
    </div>
  );
}

function ScopeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors",
        active
          ? "border-brand-200 bg-brand-50 text-brand-700"
          : "border-line bg-white text-ink-3 hover:border-line-strong hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
