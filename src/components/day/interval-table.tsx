"use client";

import { Fragment, useMemo, useState } from "react";
import { Download, Filter } from "lucide-react";
import { BAND_COLORS, MODELS, MODEL_FIELD, MODEL_IDS } from "@/lib/config/models";
import type { BandCode, IntervalRecord, PlantConfig } from "@/lib/types";
import {
  Button,
  Card,
  CardHeader,
  ModelDot,
  ToleranceGlyph,
} from "@/components/ui/primitives";
import {
  blockToClock,
  formatDay,
  formatDayWithWeekday,
  parseTimestampBlock,
  parseTimestampDay,
} from "@/lib/utils/date";
import { formatInt } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type FilterMode = "daylight" | "all" | "breach" | "missing";

const FILTERS: { id: FilterMode; label: string }[] = [
  { id: "daylight", label: "Daylight" },
  { id: "all", label: "All blocks" },
  { id: "breach", label: "Outside Band A" },
  { id: "missing", label: "Missing actual" },
];

const ALL_DAYS = "__all__";

/**
 * Exact block-by-block values (PRD §13). Supporting detail, deliberately below
 * the chart — the table is never the primary experience.
 *
 * Each model's reading carries the deviation twice, at two grains:
 *   · the glyph        — pass/fail at the Band A edge, ±X% of the block's Actual
 *   · the band letter  — how far past that edge it landed, read from the same
 *                        `bands` field the distribution chart counts
 * One number, two readings — never two measurements.
 */
export function IntervalTable({
  intervals,
  plant,
  date,
}: {
  intervals: IntervalRecord[];
  plant: PlantConfig;
  /** Filename stem for the export — the selected day, or the range. */
  date: string;
}) {
  // Defaults to daylight: the night blocks are all zero and bury the part of the
  // day anyone is actually investigating. The header always states how many of
  // the expected blocks are on screen.
  const [filter, setFilter] = useState<FilterMode>("daylight");
  const tol = plant.visual_tolerance_pct / 100;

  const days = useMemo(
    () => [...new Set(intervals.map((r) => parseTimestampDay(r.timestamp)))],
    [intervals],
  );
  const multiDay = days.length > 1;
  const [activeDay, setActiveDay] = useState<string>(ALL_DAYS);
  const day = multiDay && days.includes(activeDay) ? activeDay : ALL_DAYS;

  const scoped = useMemo(
    () =>
      day === ALL_DAYS
        ? intervals
        : intervals.filter((r) => parseTimestampDay(r.timestamp) === day),
    [intervals, day],
  );

  const rows = useMemo(() => {
    return scoped.filter((row) => {
      if (filter === "daylight") return row.eligible || row.actual_mw === null;
      if (filter === "missing") return row.actual_mw === null;
      if (filter === "breach") {
        if (row.actual_mw === null) return false;
        return MODEL_IDS.some((id) => {
          const v = row[MODEL_FIELD[id]];
          return v !== null && Math.abs(v - row.actual_mw!) > row.actual_mw! * tol;
        });
      }
      return true;
    });
  }, [scoped, filter, tol]);

  function exportCsv() {
    const header = [
      "timestamp",
      "block",
      "actual_mw",
      "actual_available",
      "external_qca_mw",
      "external_qca_band",
      "sunsure_internal_mw",
      "sunsure_internal_band",
      "nevron_mw",
      "nevron_band",
      "eligible",
    ];
    const lines = [header.join(",")];
    for (const row of intervals) {
      lines.push(
        [
          row.timestamp,
          row.block,
          row.actual_mw ?? "",
          row.actual_available,
          row.external_qca_mw ?? "",
          row.bands?.external_qca ?? "",
          row.sunsure_internal_mw ?? "",
          row.bands?.sunsure_internal ?? "",
          row.nevron_mw ?? "",
          row.bands?.nevron ?? "",
          row.eligible,
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${plant.id}-${date}-blocks.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Block-by-block detail"
        subtitle={`${formatInt(rows.length)} of ${formatInt(scoped.length)} blocks shown${
          day === ALL_DAYS && multiDay ? ` across ${days.length} days` : ""
        } · deviation is measured against each block's Actual`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-line-strong bg-surface-sunken p-0.5">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-[6px] px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                    filter === f.id
                      ? "bg-white text-ink shadow-[0_1px_2px_rgba(16,34,27,0.08)]"
                      : "text-ink-3",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={exportCsv}>
              <Download className="size-3.5" />
              CSV
            </Button>
          </div>
        }
      />

      {/* Day tabs — only meaningful once the period spans more than one day. */}
      {multiDay ? (
        <div className="scrollbar-slim -mt-1 flex items-center gap-1 overflow-x-auto border-b border-line px-5 pb-2.5">
          <DayTab
            label={`All ${days.length} days`}
            active={day === ALL_DAYS}
            onClick={() => setActiveDay(ALL_DAYS)}
          />
          <span className="mx-1 h-4 w-px shrink-0 bg-line" />
          {days.map((d) => (
            <DayTab
              key={d}
              label={formatDayWithWeekday(d)}
              active={day === d}
              onClick={() => setActiveDay(d)}
            />
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span className="grid size-10 place-items-center rounded-xl bg-surface-sunken text-ink-3">
            <Filter className="size-4" />
          </span>
          <p className="mt-3 text-[13.5px] font-medium text-ink">No blocks match this filter</p>
          <p className="mt-1 text-[12.5px] text-ink-3">
            {filter === "breach"
              ? "Every forecast stayed inside Band A here."
              : filter === "missing"
                ? "Actual telemetry is complete here."
                : "No daylight blocks were reported here."}
          </p>
        </div>
      ) : (
        <div className="scrollbar-slim max-h-[560px] overflow-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_var(--color-line)]">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10.5px] font-semibold tracking-[0.06em] text-ink-4 uppercase">
                  Block
                </th>
                <th className="px-4 py-2.5 text-right text-[10.5px] font-semibold tracking-[0.06em] text-ink-4 uppercase">
                  Actual
                </th>
                {MODEL_IDS.map((id) => (
                  <th
                    key={id}
                    className="px-4 py-2.5 text-right text-[10.5px] font-semibold tracking-[0.06em] text-ink-4 uppercase"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <ModelDot color={MODELS[id].color} size={6} />
                      {MODELS[id].shortName}
                      <span className="font-normal text-ink-4/70">MW · dev · ± · band</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const block = parseTimestampBlock(row.timestamp);
                const rowDay = parseTimestampDay(row.timestamp);
                const actual = row.actual_mw;
                const startsDay =
                  day === ALL_DAYS &&
                  multiDay &&
                  (i === 0 || parseTimestampDay(rows[i - 1].timestamp) !== rowDay);

                return (
                  <Fragment key={row.timestamp}>
                    {startsDay ? (
                      <tr className="border-t border-line">
                        <th
                          colSpan={2 + MODEL_IDS.length}
                          scope="colgroup"
                          className="sticky top-[38px] z-[9] bg-surface-sunken px-4 py-1.5 text-left text-[11px] font-semibold tracking-[0.06em] text-ink-2 uppercase shadow-[0_1px_0_var(--color-line)]"
                        >
                          {formatDayWithWeekday(rowDay)}
                        </th>
                      </tr>
                    ) : null}
                    <tr
                      className={cn(
                        "border-t border-line-soft",
                        actual === null && "bg-surface-sunken",
                        !row.eligible && actual !== null && "opacity-55",
                      )}
                    >
                      <td className="px-4 py-2 text-[12.5px] font-medium whitespace-nowrap text-ink">
                        {day === ALL_DAYS && multiDay ? (
                          <span className="tnum mr-2.5 text-[11px] text-ink-3">
                            {formatDay(rowDay, { year: false })}
                          </span>
                        ) : null}
                        <span className="tnum">{blockToClock(block)}</span>
                        <span className="ml-2 text-[10.5px] text-ink-4">#{block + 1}</span>
                      </td>
                      <td className="tnum px-4 py-2 text-right text-[12.5px] font-semibold text-ink">
                        {actual === null ? (
                          <span className="text-[11.5px] font-normal text-warn">
                            no telemetry
                          </span>
                        ) : (
                          actual.toFixed(3)
                        )}
                      </td>
                      {MODEL_IDS.map((id) => {
                        const v = row[MODEL_FIELD[id]];
                        const breach =
                          actual !== null && v !== null && Math.abs(v - actual) > actual * tol;
                        const dev =
                          actual !== null && v !== null && actual > 0.05
                            ? ((v - actual) / actual) * 100
                            : null;
                        return (
                          <td key={id} className="px-4 py-2 text-right">
                            {v === null ? (
                              <span className="text-[11.5px] text-warn">no value</span>
                            ) : (
                              <span className="inline-flex items-center justify-end gap-2">
                                <span
                                  className={cn(
                                    "tnum text-[12.5px]",
                                    breach ? "font-semibold text-ink" : "text-ink-2",
                                  )}
                                >
                                  {v.toFixed(3)}
                                </span>
                                <span
                                  className={cn(
                                    "tnum w-[52px] text-right text-[10.5px]",
                                    breach ? "text-warn" : "text-ink-4",
                                  )}
                                >
                                  {dev === null
                                    ? "—"
                                    : `${dev >= 0 ? "+" : "−"}${Math.abs(dev).toFixed(1)}%`}
                                </span>
                                {actual === null ? (
                                  <span className="inline-block size-[16px]" />
                                ) : (
                                  <ToleranceGlyph
                                    outside={breach}
                                    tolerancePct={plant.visual_tolerance_pct}
                                    modelName={MODELS[id].name}
                                  />
                                )}
                                <BandChip
                                  band={row.bands?.[id] ?? null}
                                  modelName={MODELS[id].name}
                                />
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* The two judgements, spelled out. This is the guard against reading the
          glyph and the band letter as the same measurement. */}
      <div className="space-y-1.5 border-t border-line bg-surface-muted px-5 py-3 text-[11.5px] text-ink-3">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <ToleranceGlyph outside={false} tolerancePct={plant.visual_tolerance_pct} modelName="" />
            <span>
              in Band A — within ±{plant.visual_tolerance_pct}% of{" "}
              <strong className="font-semibold">Actual</strong>
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ToleranceGlyph outside tolerancePct={plant.visual_tolerance_pct} modelName="" />
            <span>outside Band A</span>
          </span>
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            {plant.official_bands.map((b) => (
              <BandChip key={b} band={b} modelName="" />
            ))}
            <span className="ml-1">
              official band — the same deviation, graded: {bandLegend(plant)}
            </span>
          </span>
        </p>
        <p className="text-ink-4">
          The glyph and the letter are the same measurement: the glyph is pass/fail at Band A&apos;s
          edge, the letter says how far past it the block landed. Both are the values the band
          distribution chart counts, and the chart above shades the same boundary.
        </p>
      </div>
    </Card>
  );
}

function DayTab({
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
        "shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200 ring-inset"
          : "text-ink-3 hover:bg-canvas-deep hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function BandChip({ band, modelName }: { band: BandCode | null; modelName: string }) {
  if (!band) {
    return <span className="inline-block w-[18px] text-center text-[10.5px] text-ink-4">—</span>;
  }
  return (
    <span
      className="inline-grid w-[18px] shrink-0 place-items-center rounded-[4px] py-[2px] text-[10px] leading-none font-bold"
      style={{ backgroundColor: `${BAND_COLORS[band]}1f`, color: BAND_COLORS[band] }}
      title={`${modelName ? `${modelName}: ` : ""}official Band ${band} — deviation as a share of this block's Actual generation`}
    >
      {band}
    </span>
  );
}

/** "A ≤ 10% · B 10–15% · C 15–20% · D > 20%" — read straight off the config so
 *  the legend cannot describe different edges from the classifier. */
function bandLegend(plant: PlantConfig): string {
  return plant.official_band_thresholds
    .map((t, i, all) => {
      if (t.upto_pct === null) return `${t.band} > ${all[i - 1]?.upto_pct}%`;
      if (i === 0) return `${t.band} ≤ ${t.upto_pct}%`;
      return `${t.band} ${all[i - 1]?.upto_pct}–${t.upto_pct}%`;
    })
    .join(" · ");
}
