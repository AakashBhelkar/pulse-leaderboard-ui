"use client";

import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queries";
import { PLANT_LIST } from "@/lib/config/plants";
import { MODELS, MODEL_IDS } from "@/lib/config/models";
import { DSM_BASIS_TEXT } from "@/lib/config/metric-catalog";
import { MetricTooltip } from "@/components/metrics/metric-tooltip";
import { Skeleton } from "@/components/ui/primitives";
import type { DsmOutcome, ModelId, PlantId } from "@/lib/types";
import type { ScenarioId } from "@/lib/mock/scenarios";
import { formatInr, formatInt } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** A settled or hypothetical cost, reduced to what the grid needs to draw. */
interface Cell {
  penalty: number;
  pct: number;
  revenue: number;
  energy: number;
}

interface PlantRow {
  id: PlantId | "fleet";
  name: string;
  capacity: number | null;
  tariff: number | null;
  eligible: number;
  scheduled: Cell | null;
  models: Partial<Record<ModelId, Cell>>;
  /** Cheapest counterfactual on this row, for the marker. */
  cheapest: ModelId | null;
}

const toCell = (o: DsmOutcome | null | undefined): Cell | null =>
  o
    ? {
        penalty: o.penalty_inr,
        pct: o.pct_of_revenue,
        revenue: o.revenue_inr,
        energy: o.energy_mwh,
      }
    : null;

function cheapestOf(models: Partial<Record<ModelId, Cell>>): ModelId | null {
  return MODEL_IDS.reduce<ModelId | null>((best, id) => {
    const c = models[id];
    if (!c) return best;
    const b = best ? models[best] : undefined;
    return b === undefined || c.penalty < b.penalty ? id : best;
  }, null);
}

/**
 * Cost of deviation, per plant and then for the fleet.
 *
 * Plants down, schedules across: each row is one plant's settlement cost as
 * scheduled and under each model, so a plant carrying the fleet's penalty is
 * visible instead of being averaged away. The fleet row sums penalties and
 * revenues before dividing — averaging the plants' percentages would weight a
 * 12 MW plant like a 20 MW one, which is not how a settlement bill works.
 */
export function DsmCounterfactual({
  from,
  to,
  scenario,
}: {
  from: string;
  to: string;
  scenario: ScenarioId;
}) {
  const results = useQueries({
    queries: PLANT_LIST.map((plant) => {
      const scope = { plantId: plant.id, from, to, scenario };
      return { queryKey: queryKeys.summary(scope), queryFn: () => api.summary(scope) };
    }),
  });

  const pending = results.some((r) => r.isPending);

  const rows: PlantRow[] = [];
  const fleetScheduled = { penalty: 0, revenue: 0, energy: 0 };
  const fleetModels = new Map<ModelId, { penalty: number; revenue: number; energy: number }>(
    MODEL_IDS.map((id) => [id, { penalty: 0, revenue: 0, energy: 0 }]),
  );
  let fleetEligible = 0;
  const tariffs = new Set<number>();
  let basis: string | null = null;

  PLANT_LIST.forEach((plant, i) => {
    const s = results[i]?.data;
    if (!s) return;
    basis ??= s.dsm.basis;
    tariffs.add(s.dsm.tariff_inr_per_kwh);
    fleetEligible += s.coverage.eligible_intervals;

    const scheduled = toCell(s.dsm.as_scheduled);
    if (scheduled) {
      fleetScheduled.penalty += scheduled.penalty;
      fleetScheduled.revenue += scheduled.revenue;
      fleetScheduled.energy += scheduled.energy;
    }

    const models: Partial<Record<ModelId, Cell>> = {};
    for (const id of MODEL_IDS) {
      const c = toCell(s.dsm.counterfactual[id]);
      if (!c) continue;
      models[id] = c;
      const agg = fleetModels.get(id)!;
      agg.penalty += c.penalty;
      agg.revenue += c.revenue;
      agg.energy += c.energy;
    }

    rows.push({
      id: plant.id,
      name: plant.name,
      capacity: plant.capacity_mw,
      tariff: s.dsm.tariff_inr_per_kwh,
      eligible: s.coverage.eligible_intervals,
      scheduled,
      models,
      cheapest: cheapestOf(models),
    });
  });

  const asCell = (v: { penalty: number; revenue: number; energy: number }): Cell => ({
    penalty: v.penalty,
    pct: v.revenue > 0 ? (v.penalty / v.revenue) * 100 : 0,
    revenue: v.revenue,
    energy: v.energy,
  });

  const fleetModelCells: Partial<Record<ModelId, Cell>> = {};
  for (const id of MODEL_IDS) {
    const agg = fleetModels.get(id)!;
    if (agg.revenue > 0) fleetModelCells[id] = asCell(agg);
  }

  const fleetRow: PlantRow = {
    id: "fleet",
    name: "All plants",
    capacity: null,
    tariff: tariffs.size === 1 ? [...tariffs][0] : null,
    eligible: fleetEligible,
    scheduled: fleetScheduled.revenue > 0 ? asCell(fleetScheduled) : null,
    models: fleetModelCells,
    cheapest: cheapestOf(fleetModelCells),
  };

  const simulated = basis === "simulated_model_attribution" || basis === null;

  /* One scale for the whole grid, so a bar in the Nevron column of one plant is
     directly comparable to a bar in the QCA column of another. */
  const worst = Math.max(
    1,
    ...rows.flatMap((r) => [
      r.scheduled?.penalty ?? 0,
      ...MODEL_IDS.map((id) => r.models[id]?.penalty ?? 0),
    ]),
  );

  return (
    <section className="fx-panel relative flex flex-col overflow-hidden">
      <span aria-hidden="true" className="fx-corners">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span aria-hidden="true" className="fx-sweep" />

      <header className="relative z-[3] px-6 pt-5 pb-4">
        <p className="fx-rule-label">Cost of deviation</p>
        <p className="mt-2.5 max-w-[54ch] text-[12.5px] leading-relaxed text-ink-3">
          What settlement cost each plant, and what it would have cost had each model been submitted
          as the schedule instead.
        </p>
      </header>

      <div className="scrollbar-slim relative z-[3] overflow-x-auto border-y border-line-soft">
        {pending ? (
          <div className="space-y-2 px-6 py-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : (
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="bg-surface-muted">
                <th className="px-4 py-2.5 text-left">
                  <span className="text-[10px] font-semibold tracking-[0.1em] text-ink-4 uppercase">
                    Plant
                  </span>
                </th>
                <th className="px-2.5 py-2.5 text-right">
                  <span className="text-[10px] font-semibold tracking-[0.1em] text-ink-4 uppercase">
                    {simulated ? "Scheduled*" : "Scheduled"}
                  </span>
                </th>
                {MODEL_IDS.map((id) => (
                  <th key={id} className="px-2.5 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-[3px] rounded-full"
                        style={{ backgroundColor: MODELS[id].color }}
                      />
                      <span className="text-[10px] font-semibold tracking-[0.1em] text-ink-4 uppercase">
                        {MODELS[id].shortName}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row key={row.id} row={row} worst={worst} />
              ))}
              <Row row={fleetRow} worst={worst} total />
            </tbody>
          </table>
        )}
      </div>

      <footer className="relative z-[3] mt-auto space-y-1.5 bg-surface-muted px-6 py-3">
        <p className="text-[11px] leading-snug text-ink-3">
          Priced at ₹{tariffs.size === 1 ? [...tariffs][0].toFixed(2) : "per-plant tariff"}/kWh
          across {formatInt(fleetEligible)} eligible blocks. Revenue is generated energy at the same
          tariff. The fleet row sums rupees before dividing, so it is not the average of the rows
          above it.
        </p>
        <p className="text-[11px] leading-snug text-ink-4">
          {simulated ? `* ${DSM_BASIS_TEXT.simulated_model_attribution.text}` : DSM_BASIS_TEXT.actual_schedule_linked.text}
        </p>
      </footer>
    </section>
  );
}

function Row({ row, worst, total }: { row: PlantRow; worst: number; total?: boolean }) {
  return (
    <tr
      className={cn(
        "border-t border-line-soft",
        total ? "bg-surface-sunken" : "hover:bg-surface-sunken/60",
      )}
    >
      <th scope="row" className="px-4 py-3 text-left align-top">
        <span
          className={cn(
            "block text-[12.5px] whitespace-nowrap",
            total ? "font-bold text-ink" : "font-semibold text-ink",
          )}
        >
          {row.name}
        </span>
        <span className="mt-0.5 block text-[10.5px] whitespace-nowrap text-ink-4">
          {row.capacity !== null
            ? `${row.capacity} MW · ${formatInt(row.eligible)} blocks`
            : `fleet · ${formatInt(row.eligible)} blocks`}
        </span>
      </th>

      <MoneyCell cell={row.scheduled} worst={worst} color="var(--color-ink-3)" total={total} />
      {MODEL_IDS.map((id) => (
        <MoneyCell
          key={id}
          cell={row.models[id] ?? null}
          worst={worst}
          color={MODELS[id].color}
          best={row.cheapest === id}
          total={total}
          label={`${MODELS[id].name}, ${row.name}`}
        />
      ))}
    </tr>
  );
}

function MoneyCell({
  cell,
  worst,
  color,
  best,
  total,
  label,
}: {
  cell: Cell | null;
  worst: number;
  color: string;
  best?: boolean;
  total?: boolean;
  label?: string;
}) {
  if (!cell) {
    return <td className="px-2.5 py-3 text-right align-top text-[12px] text-ink-4">—</td>;
  }

  return (
    <td className="px-2.5 py-3 text-right align-top">
      <MetricTooltip
        metric="estimated_dsm_impact_pct"
        value={`${cell.pct.toFixed(2)}%`}
        dsmBasis={null}
        extra={
          <>
            {label ? `${label}: ` : ""}
            {formatInr(cell.penalty)} penalty on {formatInr(cell.revenue)} of energy revenue, from{" "}
            {cell.energy.toFixed(1)} MWh generated.
          </>
        }
        side="left"
      >
        <span className="inline-block cursor-help text-right">
          <span className="inline-flex items-center gap-1.5">
            {best ? (
              <span
                aria-label="cheapest"
                title="Cheapest for this plant"
                className="size-1.5 shrink-0 rounded-full bg-brand-600"
              />
            ) : null}
            <span
              className={cn(
                "readout text-[13.5px] leading-none whitespace-nowrap",
                best ? "font-semibold text-ink" : total ? "font-semibold text-ink" : "text-ink",
              )}
            >
              {formatInr(cell.penalty)}
            </span>
          </span>
          <span className="tnum mt-1 block text-[10.5px] whitespace-nowrap text-ink-3">
            {cell.pct.toFixed(2)}%
          </span>
          <span className="mt-1.5 block h-[2px] w-full overflow-hidden rounded-full bg-line-soft">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(3, (cell.penalty / worst) * 100)}%`,
                backgroundColor: color,
              }}
            />
          </span>
        </span>
      </MetricTooltip>
    </td>
  );
}
