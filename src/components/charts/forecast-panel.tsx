"use client";

import { useMemo, useState } from "react";
import { CalendarSearch, Crosshair } from "lucide-react";
import { ForecastChart } from "./forecast-chart";
import {
  ACTUAL_COLOR,
  MODELS,
  MODEL_FIELD,
  MODEL_IDS,
  TOLERANCE_COLOR,
} from "@/lib/config/models";
import type { ModelId, PlantConfig, SeriesResponse } from "@/lib/types";
import { Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { MetricTooltip } from "@/components/metrics/metric-tooltip";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { describeBoundary } from "@/lib/config/band";
import { formatRange } from "@/lib/utils/date";
import { formatInt } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function ForecastPanel({
  series,
  plant,
  isPending,
  height = 392,
  dayScope = null,
}: {
  series?: SeriesResponse;
  plant: PlantConfig;
  isPending?: boolean;
  height?: number;
  /**
   * Set when the page is narrowed to one day inside a longer period. The
   * workspace still holds the wider period, so without this the panel would
   * label a single day with the period's dates and offer a day-drill-down on a
   * chart that is already one day deep.
   */
  dayScope?: { date: string; label: string } | null;
}) {
  const { visibleModels, toggleModel, isSingleDay, from, to, openDay } = useWorkspace();
  const [markBreaches, setMarkBreaches] = useState(true);

  const singleDay = dayScope !== null || isSingleDay;
  const multiDay = !singleDay;
  const boundary = describeBoundary(plant);

  /**
   * The two thresholds, counted over the same blocks.
   *
   * This exists because the chart and the band distribution answer different
   * questions and were being read as if they answered the same one. Both counts
   * come from this one pass: the envelope check from the plant's tolerance, the
   * band from the `bands` the service stamped on each block.
   */
  const reconciliation = useMemo(() => {
    if (!series) return null;
    const tol = plant.visual_tolerance_pct / 100;
    const eligible = series.intervals.filter((r) => r.eligible && r.actual_mw !== null);
    if (!eligible.length) return null;
    return {
      eligible: eligible.length,
      unscored: series.intervals.filter(
        (r) => !r.eligible && r.actual_mw !== null && r.actual_mw > 0.05,
      ).length,
      rows: MODEL_IDS.map((id) => {
        let outsideEnvelope = 0;
        let outsideBandA = 0;
        for (const r of eligible) {
          const v = r[MODEL_FIELD[id]];
          if (v === null) continue;
          if (Math.abs(v - r.actual_mw!) > r.actual_mw! * tol) outsideEnvelope += 1;
          const band = r.bands?.[id];
          if (band && band !== "A") outsideBandA += 1;
        }
        return { id, outsideEnvelope, outsideBandA };
      }),
    };
  }, [series, plant.visual_tolerance_pct]);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Forecast vs Actual"
        subtitle={
          series
            ? `${dayScope ? dayScope.label : formatRange(from, to)} · ${
                series.resolution === "hourly"
                  ? "hourly averages"
                  : "15-minute blocks"
              }${multiDay ? " · click any day to narrow to its 96 blocks" : ""}`
            : undefined
        }
        actions={
          <button
            onClick={() => setMarkBreaches((v) => !v)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium transition-colors",
              markBreaches
                ? "border-line-hud bg-tint text-hud"
                : "border-line-strong bg-surface text-ink-3 hover:bg-surface-sunken",
            )}
            title="Thicken the stretch of each forecast that leaves Band A"
          >
            <Crosshair className="size-3.5" />
            Mark breaches
          </button>
        }
      />

      <Legend
        plant={plant}
        visibleModels={visibleModels}
        onToggle={toggleModel}
      />

      <div className="px-2 pb-2">
        {isPending || !series ? (
          <Skeleton className="mx-3 rounded-lg" style={{ height }} />
        ) : (
          <ForecastChart
            intervals={series.intervals}
            plant={plant}
            visibleModels={visibleModels}
            resolution={series.resolution}
            isSingleDay={singleDay}
            markBreaches={markBreaches}
            showZoom={multiDay}
            onDayClick={multiDay ? openDay : undefined}
            height={height}
          />
        )}
      </div>

      {reconciliation ? (
        <div className="border-t border-line bg-surface-muted px-5 py-3">
          <p className="text-[11.5px] leading-relaxed text-ink-3">
            <span className="font-semibold text-ink-2">
              The shaded band is Band A: ±{boundary.pct}% of each block&apos;s Actual.
            </span>{" "}
            A forecast outside it is a block outside Band A. Counts below cover the same{" "}
            {formatInt(reconciliation.eligible)} eligible blocks and are the figures the band
            distribution chart plots.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
            {reconciliation.rows.map((row) => (
              <span key={row.id} className="flex items-center gap-2 text-[11.5px]">
                <span
                  aria-hidden="true"
                  className="h-3 w-[3px] shrink-0 rounded-full"
                  style={{ backgroundColor: MODELS[row.id].color }}
                />
                <span className="font-medium text-ink">{MODELS[row.id].shortName}</span>
                <span className="tnum text-ink-3">
                  {row.outsideBandA} of {reconciliation.eligible} outside Band A
                </span>
              </span>
            ))}
          </div>
          {reconciliation.unscored > 0 ? (
            <p className="mt-2 text-[11px] text-ink-4">
              A further {reconciliation.unscored}{" "}
              {reconciliation.unscored === 1
                ? "block is drawn on the chart but falls"
                : "blocks are drawn on the chart but fall"}{" "}
              outside the eligible set, so {reconciliation.unscored === 1 ? "it is" : "they are"}{" "}
              not scored by either measure.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line bg-surface-muted px-5 py-2.5 text-[11.5px] text-ink-3">
        <span>Actual is never interpolated — the line breaks where telemetry is missing.</span>
        {multiDay ? (
          <span className="ml-auto flex items-center gap-1.5 text-hud">
            <CalendarSearch className="size-3.5" />
            Pick a single day for the precise view
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function Legend({
  plant,
  visibleModels,
  onToggle,
}: {
  plant: PlantConfig;
  visibleModels: ModelId[];
  onToggle: (id: ModelId) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-5 pb-3">
      <span className="flex items-center gap-2 rounded-lg border border-line bg-surface-sunken px-2.5 py-1.5">
        <span
          className="h-[2.5px] w-5 rounded-full"
          style={{ backgroundColor: ACTUAL_COLOR }}
        />
        <span className="text-[12px] font-semibold text-ink">Actual</span>
      </span>

      <MetricTooltip metric="visual_tolerance" value={`±${describeBoundary(plant).pct}%`}>
        <span className="flex cursor-help items-center gap-2 rounded-lg border border-line bg-surface-sunken px-2.5 py-1.5">
          <span
            className="h-3.5 w-5 rounded-[3px]"
            style={{
              backgroundColor: `${TOLERANCE_COLOR}2b`,
              border: `1px solid ${TOLERANCE_COLOR}80`,
            }}
          />
          <span className="text-[12px] font-medium text-ink-2">
            {describeBoundary(plant).label}
          </span>
        </span>
      </MetricTooltip>

      <span className="mx-1 hidden h-4 w-px bg-line sm:block" />

      {MODEL_IDS.map((id) => {
        const meta = MODELS[id];
        const on = visibleModels.includes(id);
        return (
          <button
            key={id}
            onClick={() => onToggle(id)}
            aria-pressed={on}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-all",
              on
                ? "border-line bg-surface text-ink"
                : "border-line-soft bg-surface-sunken text-ink-4",
            )}
            title={on ? `Hide ${meta.name}` : `Show ${meta.name}`}
          >
            <span
              className="h-[2.5px] w-5 rounded-full transition-opacity"
              style={{ backgroundColor: meta.color, opacity: on ? 1 : 0.3 }}
            />
            <span className="text-[12px] font-medium">{meta.name}</span>
          </button>
        );
      })}
    </div>
  );
}
