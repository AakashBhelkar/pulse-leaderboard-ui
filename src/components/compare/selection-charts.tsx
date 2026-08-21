"use client";

import { useSeries } from "@/lib/api/queries";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/states";
import { PLANTS } from "@/lib/config/plants";
import { ACTUAL_COLOR, MODELS, MODEL_IDS, TOLERANCE_COLOR } from "@/lib/config/models";
import type { CompareRow, CompareSelection } from "@/lib/types";
import type { ScenarioId } from "@/lib/mock/scenarios";
import { formatInt } from "@/lib/utils/format";
import { formatRange } from "@/lib/utils/date";

/**
 * Small multiples: one forecast chart per selection, on a shared visual grammar
 * so shapes can be read against each other directly.
 *
 * Sample size is printed on every panel — two selections can look equally solid
 * on a chart while one rests on 52 intervals and the other on 3,800.
 */
export function SelectionCharts({
  selections,
  rows,
  scenario,
  accents,
}: {
  selections: CompareSelection[];
  rows: CompareRow[];
  scenario: ScenarioId;
  accents: string[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {selections.map((selection, index) => (
        <SelectionChart
          key={selection.id}
          selection={selection}
          row={rows.find((r) => r.selection.id === selection.id)}
          scenario={scenario}
          index={index}
          accent={accents[index % accents.length]}
        />
      ))}
    </div>
  );
}

function SelectionChart({
  selection,
  row,
  scenario,
  index,
  accent,
}: {
  selection: CompareSelection;
  row?: CompareRow;
  scenario: ScenarioId;
  index: number;
  accent: string;
}) {
  const plant = PLANTS[selection.plant_id];
  const series = useSeries({
    plantId: selection.plant_id,
    from: selection.from,
    to: selection.to,
    scenario,
  });

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-5 shrink-0 place-items-center rounded-[2px] text-[10px] font-bold text-ink-inverse"
            style={{ backgroundColor: accent }}
          >
            {index + 1}
          </span>
          <div>
            <p className="text-[13px] leading-none font-semibold text-ink">{plant.name}</p>
            <p className="readout mt-1.5 text-[11px] text-ink-3">
              {formatRange(selection.from, selection.to)}
            </p>
          </div>
        </div>

        {/* The guardrail: sample size stated on the panel itself. */}
        <div className="text-right">
          <p className="readout text-[13px] leading-none font-semibold text-ink">
            {row ? formatInt(row.coverage.eligible_intervals) : "—"}
          </p>
          <p className="mt-1.5 text-[9.5px] tracking-[0.14em] text-ink-4 uppercase">
            eligible intervals
          </p>
        </div>
      </div>

      <div className="px-2 pt-2">
        {series.isError ? (
          <div className="p-3">
            <ErrorState error={series.error} onRetry={() => series.refetch()} compact />
          </div>
        ) : series.isPending || !series.data ? (
          <Skeleton className="h-[188px]" />
        ) : (
          <ForecastChart
            intervals={series.data.intervals}
            plant={plant}
            visibleModels={[...MODEL_IDS]}
            resolution={series.data.resolution}
            isSingleDay={selection.from === selection.to}
            markBreaches
            compact
            height={188}
          />
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line-soft px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[10px] tracking-[0.08em] text-ink-3 uppercase">
          <span className="h-[2px] w-3.5" style={{ backgroundColor: ACTUAL_COLOR }} />
          Actual
        </span>
        <span className="flex items-center gap-1.5 text-[10px] tracking-[0.08em] text-ink-3 uppercase">
          <span
            className="h-3 w-3.5 rounded-[1px]"
            style={{
              backgroundColor: `${TOLERANCE_COLOR}2b`,
              border: `1px solid ${TOLERANCE_COLOR}66`,
            }}
          />
          ±{plant.visual_tolerance_pct}%
        </span>
        {MODEL_IDS.map((id) => (
          <span
            key={id}
            className="flex items-center gap-1.5 text-[10px] tracking-[0.08em] text-ink-3 uppercase"
          >
            <span className="h-[2px] w-3.5" style={{ backgroundColor: MODELS[id].color }} />
            {MODELS[id].shortName}
          </span>
        ))}
        <span className="ml-auto text-[10px] tracking-[0.08em] text-ink-4 uppercase">
          {plant.state_short} · {plant.capacity_mw} MW
        </span>
      </div>
    </div>
  );
}
