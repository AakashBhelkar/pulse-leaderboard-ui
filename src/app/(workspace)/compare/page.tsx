"use client";

import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { CalendarDays, ChevronDown, Factory, Info, Plus, RotateCcw } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useComparison } from "@/lib/api/queries";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { SelectionEditor } from "@/components/compare/selection-editor";
import { SelectionCharts } from "@/components/compare/selection-charts";
import { EChart } from "@/components/charts/echart";
import {
  TIP,
  axisLabelStyle,
  escapeHtml,
  tooltipShell,
  valueAxis,
} from "@/components/charts/chart-theme";
import { MetricTooltip } from "@/components/metrics/metric-tooltip";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Skeleton,
  WinnerMark,
} from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/states";
import { MODELS, MODEL_IDS } from "@/lib/config/models";
import { METRIC_CATALOG } from "@/lib/config/metric-catalog";
import {
  COMPARISON_METRICS,
  comparisonDirection,
  comparisonValue,
  formatComparisonValue,
  isCrossPlantComparable,
  type ComparisonMetricKey,
} from "@/lib/metrics/normalize";
import type { CompareSelection, MetricKey, ModelId, PlantId } from "@/lib/types";
import { PLANT_LIST } from "@/lib/config/plants";
import { addDays, formatRange } from "@/lib/utils/date";
import { formatInt, formatMetric } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const ACCENTS = ["#0b6e4f", "#f5b83d", "#57b6f5", "#9d8cff", "#ff6b5c", "#00c98b"];

const MATRIX_COLUMNS: MetricKey[] = [
  "rmse_mw",
  "mae_mw",
  "bias_mw",
  "band_a_pct",
  "outside_band_a_pct",
  "estimated_dsm_impact_pct",
];

/** First plant not already in the comparison, so "Add" is never a duplicate. */
function nextUnusedPlant(rows: CompareSelection[]): PlantId {
  const used = new Set(rows.map((r) => r.plant_id));
  const free = PLANT_LIST.find((p) => !used.has(p.id));
  return (free ?? PLANT_LIST[0]).id;
}

export default function ComparePage() {
  const { plantId, from, to, scenario } = useWorkspace();

  // Seeded once from the workspace selection, plus a contrasting second row so
  // the comparison is meaningful the moment the page opens. From then on the
  // builder is user-owned and does not re-sync.
  const [selections, setSelections] = useState<CompareSelection[]>(() => [
    { id: "sel-1", plant_id: plantId, from, to },
    {
      id: "sel-2",
      plant_id: plantId === "gursarai" ? "erandol" : "gursarai",
      from,
      to,
    },
  ]);
  /**
   * A comparison varies exactly one thing.
   *
   * Letting both the plant and the period differ produced rows with nothing in
   * common — no shared weather, no shared period, different capacity and a
   * different band structure. Constraining it to one axis is what makes the
   * matrix readable, and it is enforced structurally rather than warned about.
   */
  const [axis, setAxis] = useState<"plant" | "period">("plant");

  // Normalised RMSE is the default: it is the only error metric that stays
  // meaningful when the selections span plants of different capacity.
  const [focus, setFocus] = useState<ComparisonMetricKey>("nrmse_pct");

  const { data, isPending, isError, error, refetch } = useComparison(selections, scenario);

  function switchAxis(next: "plant" | "period") {
    if (next === axis) return;
    setAxis(next);
    setSelections((rows) => {
      const first = rows[0];
      if (!first) return rows;
      return next === "plant"
        ? // Comparing plants: every row adopts the first row's period.
          rows.map((r) => ({ ...r, from: first.from, to: first.to }))
        : // Comparing periods: every row adopts the first row's plant.
          rows.map((r) => ({ ...r, plant_id: first.plant_id }));
    });
  }

  /**
   * One pass: the varying dimension lands on the edited row, the fixed one lands
   * on every row. That invariant is what keeps the comparison to a single axis
   * no matter which row was touched.
   */
  function update(id: string, next: CompareSelection) {
    setSelections((rows) =>
      rows.map((row) => {
        const target = row.id === id;
        return axis === "plant"
          ? // Plant varies per row; period is shared.
            {
              ...row,
              plant_id: target ? next.plant_id : row.plant_id,
              from: next.from,
              to: next.to,
            }
          : // Period varies per row; plant is shared.
            {
              ...row,
              plant_id: next.plant_id,
              from: target ? next.from : row.from,
              to: target ? next.to : row.to,
            };
      }),
    );
  }

  function reset() {
    setSelections([
      { id: "sel-1", plant_id: plantId, from, to },
      {
        id: "sel-2",
        plant_id: plantId === "gursarai" ? "erandol" : "gursarai",
        from,
        to,
      },
    ]);
  }

  function add() {
    if (selections.length >= 6) return;
    const last = selections[selections.length - 1];
    setSelections((s) => [
      ...s,
      axis === "plant"
        ? {
            // Another plant over the same period: only the plant differs.
            id: `sel-${Date.now()}`,
            plant_id: nextUnusedPlant(selections),
            from: last?.from ?? from,
            to: last?.to ?? to,
          }
        : {
            // The preceding window for the same plant.
            id: `sel-${Date.now()}`,
            plant_id: last?.plant_id ?? plantId,
            from: addDays(last?.from ?? from, -(Math.max(1, selections.length) * 7)),
            to: addDays(last?.to ?? to, -(Math.max(1, selections.length) * 7)),
          },
    ]);
  }

  const focusMeta = COMPARISON_METRICS.find((m) => m.key === focus) ?? COMPARISON_METRICS[0];
  const focusDef = METRIC_CATALOG[focusMeta.catalogKey];
  const crossPlant = data?.cross_plant ?? false;
  const focusComparable = isCrossPlantComparable(focus);
  const isAbsolute = focus === "rmse_mw" || focus === "mae_mw";

  /* --- Grouped bars: one group per selection, one bar per model ---------- */
  const focusOption = useMemo<EChartsOption>(() => {
    if (!data) return {};
    const suffix = isAbsolute ? " MW" : "%";

    return {
      animationDuration: 460,
      grid: { left: 4, right: 20, top: 28, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipShell,
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(16,34,27,0.04)" } },
        formatter: (raw: unknown) => {
          const params = raw as { dataIndex: number; seriesName: string; value: number }[];
          if (!params?.length) return "";
          const row = data.rows[params[0].dataIndex];
          if (!row) return "";
          const body = params
            .map((p) => {
              const meta = MODEL_IDS.map((id) => MODELS[id]).find(
                (m) => m.name === p.seriesName,
              );
              return `<tr>
                <td style="padding:2px 0"><span style="display:inline-block;width:6px;height:6px;border-radius:99px;background:${meta?.color};box-shadow:0 0 6px ${meta?.color}"></span>&nbsp;<span style="color:${TIP.label}">${escapeHtml(p.seriesName)}</span></td>
                <td style="text-align:right;padding-left:18px;color:${TIP.value};font-variant-numeric:tabular-nums">${p.value?.toFixed(isAbsolute ? 3 : 1) ?? "—"}${suffix}</td>
              </tr>`;
            })
            .join("");
          return `<div style="font-family:var(--font-geist-mono),ui-monospace,monospace;min-width:250px">
            <div style="padding:8px 12px 7px;border-bottom:1px solid ${TIP.rule};color:${TIP.head};font-size:12.5px;font-weight:700">${escapeHtml(row.plant.name)} · ${escapeHtml(formatRange(row.selection.from, row.selection.to))}</div>
            <table style="border-collapse:collapse;font-size:11.5px;margin:6px 12px 8px;width:calc(100% - 24px)">${body}</table>
            <div style="padding:6px 12px 8px;border-top:1px solid ${TIP.rule};color:${TIP.meta};font-size:10px;text-transform:uppercase;letter-spacing:0.1em">${formatInt(row.coverage.eligible_intervals)} eligible · ${escapeHtml(focusMeta.label)}</div>
          </div>`;
        },
      },
      xAxis: {
        type: "category",
        data: data.rows.map(
          (r, i) => `${i + 1}·${r.plant.name}\n${formatRange(r.selection.from, r.selection.to)}`,
        ),
        axisLine: { lineStyle: { color: "#e9ece5" } },
        axisTick: { show: false },
        axisLabel: {
          ...axisLabelStyle,
          color: "#6b7872",
          lineHeight: 14,
          hideOverlap: true,
        },
      },
      yAxis: {
        ...valueAxis,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => (isAbsolute ? String(v) : `${v}%`),
        },
      },
      series: MODEL_IDS.map((id) => ({
        name: MODELS[id].name,
        type: "bar" as const,
        barMaxWidth: 26,
        barGap: "16%",
        itemStyle: { color: MODELS[id].color, borderRadius: [2, 2, 0, 0] },
        label: {
          show: true,
          position: "top" as const,
          fontSize: 10,
          fontWeight: 600,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          color: "#6b7872",
          formatter: (p: { value: number }) =>
            p.value === null || p.value === undefined
              ? ""
              : isAbsolute
                ? p.value.toFixed(2)
                : `${p.value.toFixed(1)}%`,
        },
        data: data.rows.map((r) => {
          const m = r.models.find((x) => x.model === id);
          return m ? comparisonValue(m, r.plant, focus) : null;
        }),
      })),
    } as unknown as EChartsOption;
  }, [data, focus, focusMeta.label, isAbsolute]);

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Comparison workspace</p>
        <h1 className="mt-2.5 text-[24px] leading-none font-semibold tracking-[-0.02em] text-ink">
          Compare plants and periods
        </h1>
        <p className="mt-2.5 max-w-[80ch] text-[12.5px] leading-relaxed text-ink-3">
          One axis at a time — several plants over a shared period, or one plant across
          several periods. Winners stay independent per metric within each selection; nothing
          is combined across selections.
        </p>
      </div>

      {/* Builder */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Selections"
          subtitle={
            axis === "plant"
              ? "Comparing plants over one shared period"
              : "Comparing periods for one plant"
          }
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={reset}>
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
              <Button size="sm" variant="secondary" onClick={add} disabled={selections.length >= 6}>
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
          }
        />
        <div className="flex flex-wrap items-center gap-3 border-y border-line-soft bg-surface-muted px-5 py-3">
          <div className="flex rounded-lg border border-line-strong bg-white p-0.5">
            {(
              [
                { key: "plant", label: "Across plants", icon: Factory },
                { key: "period", label: "Across periods", icon: CalendarDays },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => switchAxis(opt.key)}
                aria-pressed={axis === opt.key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  axis === opt.key
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-3 hover:text-ink",
                )}
              >
                <opt.icon className="size-3.5" />
                {opt.label}
              </button>
            ))}
          </div>

          <p className="text-[11.5px] leading-snug text-ink-3">
            {axis === "plant"
              ? "One shared period, set on the first row. Each row picks its own plant."
              : "One shared plant, set on the first row. Each row picks its own period."}
          </p>

          <span className="ml-auto text-[11px] text-ink-4">
            {selections.length} of 6
          </span>
        </div>

        <div className="space-y-2 px-5 py-4">
          {selections.map((sel, i) => (
            <SelectionEditor
              key={sel.id}
              selection={sel}
              index={i}
              accent={ACCENTS[i % ACCENTS.length]}
              canRemove={selections.length > 1}
              varies={axis}
              sharedEditable={i === 0}
              onChange={(next) => update(sel.id, next)}
              onRemove={() => setSelections((s) => s.filter((x) => x.id !== sel.id))}
            />
          ))}
        </div>
      </Card>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} compact />
      ) : (
        <>
          {data?.notes.length ? (
            <div className="space-y-2">
              {data.notes.map((note) => (
                <div
                  key={note}
                  className="flex items-start gap-2.5 rounded-[3px] border border-line-hud bg-info-tint px-4 py-3 text-[12.5px] leading-relaxed text-info"
                >
                  <Info className="mt-[1px] size-4 shrink-0" />
                  <p>{note}</p>
                </div>
              ))}
            </div>
          ) : null}

          {/* Side-by-side evidence */}
          <div>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[12px] font-semibold tracking-[0.14em] text-ink uppercase">
                Forecast evidence, side by side
              </h2>
              <p className="text-[11.5px] text-ink-3">
                Identical grammar on every panel · sample size stated per selection
              </p>
            </div>
            {isPending || !data ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {selections.map((s) => (
                  <Skeleton key={s.id} className="h-[300px]" />
                ))}
              </div>
            ) : (
              <SelectionCharts
                selections={selections}
                rows={data.rows}
                scenario={scenario}
                accents={ACCENTS}
              />
            )}
          </div>

          {/* Metric focus */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Metric focus"
              subtitle={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    {focusDef.label} across every selection ·{" "}
                    {focusDef.direction === "higher"
                      ? "higher is better"
                      : focusDef.direction === "zero"
                        ? "closer to zero is better"
                        : "lower is better"}
                  </span>
                  {crossPlant ? (
                    <Badge tone={focusComparable ? "positive" : "caution"}>
                      {focusComparable ? "cross-plant comparable" : "single-plant only"}
                    </Badge>
                  ) : null}
                </span>
              }
              actions={
                <div className="flex items-center gap-2">
                  <span className="hidden text-[10px] font-semibold tracking-[0.14em] text-ink-4 uppercase sm:block">
                    Metric
                  </span>
                  <MetricPicker value={focus} onChange={setFocus} />
                </div>
              }
            />

            {crossPlant && !focusComparable ? (
              <div className="flex items-start gap-2.5 border-b border-line-warn bg-warn-tint px-5 py-2.5 text-[11.5px] leading-relaxed text-warn">
                <Info className="mt-[1px] size-3.5 shrink-0" />
                <p>
                  {focusDef.label} is either an absolute MW figure or tied to a
                  state-specific band structure, so these bars are not comparable between
                  plants of different capacity. Switch to NRMSE, NMAE or Bias % for a fair
                  cross-plant read.
                </p>
              </div>
            ) : null}

            <div className="px-3 py-3">
              {isPending || !data ? (
                <Skeleton className="h-[268px]" />
              ) : (
                <EChart
                  option={focusOption}
                  notMerge
                  style={{ height: 268 }}
                  ariaLabel={`${focusDef.label} compared across selections`}
                />
              )}
            </div>
          </Card>

          {/* Matrix */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Comparison matrix"
              subtitle="One block per selection and model. Winner marks are resolved within each selection."
            />
            {isPending || !data ? (
              <div className="space-y-2 p-5">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <div className="scrollbar-slim overflow-x-auto">
                <table className="w-full min-w-[1060px] border-collapse">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-[0.14em] text-ink-4 uppercase">
                        Selection
                      </th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold tracking-[0.14em] text-ink-4 uppercase">
                        Model
                      </th>
                      <th className="px-3 py-2.5 text-right">
                        <MetricTooltip metric="nrmse_pct">
                          <span className="cursor-help text-[10px] font-semibold tracking-[0.14em] text-hud uppercase">
                            NRMSE
                          </span>
                        </MetricTooltip>
                      </th>
                      {MATRIX_COLUMNS.map((key) => (
                        <th key={key} className="px-3 py-2.5 text-right">
                          <MetricTooltip
                            metric={key}
                            dsmBasis={
                              key === "estimated_dsm_impact_pct"
                                ? data.rows[0]?.models[0]?.dsm_basis
                                : null
                            }
                            bandBasis={
                              key === "band_a_pct" || key === "outside_band_a_pct"
                                ? data.rows[0]?.models[0]?.band_basis
                                : null
                            }
                          >
                            <span className="cursor-help text-[10px] font-semibold tracking-[0.14em] text-ink-4 uppercase">
                              {METRIC_CATALOG[key].label}
                            </span>
                          </MetricTooltip>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 text-right text-[10px] font-semibold tracking-[0.14em] text-ink-4 uppercase">
                        Eligible
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, rowIndex) => {
                      // NRMSE winner is resolved inside the selection, the same
                      // rule as every other metric.
                      let nrmseWinner: ModelId | null = null;
                      let bestN = Number.POSITIVE_INFINITY;
                      for (const m of row.models) {
                        const v = comparisonValue(m, row.plant, "nrmse_pct");
                        if (v !== null && v < bestN) {
                          bestN = v;
                          nrmseWinner = m.model;
                        }
                      }

                      return MODEL_IDS.map((id, modelIndex) => {
                        const model = row.models.find((m) => m.model === id);
                        const meta = MODELS[id];
                        if (!model) return null;
                        const first = modelIndex === 0;
                        const nrmse = comparisonValue(model, row.plant, "nrmse_pct");

                        return (
                          <tr
                            key={`${row.selection.id}-${id}`}
                            className={cn(
                              "hover:bg-surface-sunken/60",
                              first && rowIndex > 0 && "border-t-2 border-line-strong",
                              !first && "border-t border-line-soft",
                            )}
                          >
                            {first ? (
                              <td
                                rowSpan={MODEL_IDS.length}
                                className="border-r border-line-soft px-4 py-3 align-top"
                              >
                                <div className="flex items-start gap-2.5">
                                  <span
                                    className="mt-[2px] grid size-5 shrink-0 place-items-center rounded-[2px] text-[10px] font-bold text-ink-inverse"
                                    style={{
                                      backgroundColor: ACCENTS[rowIndex % ACCENTS.length],
                                    }}
                                  >
                                    {rowIndex + 1}
                                  </span>
                                  <div>
                                    <p className="text-[13px] font-semibold text-ink">
                                      {row.plant.name}
                                    </p>
                                    <p className="readout mt-1 text-[11.5px] text-ink-3">
                                      {formatRange(row.selection.from, row.selection.to)}
                                    </p>
                                    {/* Sample size beside every selection, so two
                                        rows of very different weight never look
                                        equally solid. */}
                                    <p className="readout mt-1.5 text-[12px] font-semibold text-hud">
                                      {formatInt(row.coverage.eligible_intervals)}
                                      <span className="ml-1.5 text-[9.5px] font-normal tracking-[0.12em] text-ink-4 uppercase">
                                        eligible
                                      </span>
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      <Badge tone="neutral">
                                        {row.plant.state_short} · {row.plant.capacity_mw} MW
                                      </Badge>
                                      <Badge tone="neutral">
                                        ±{row.plant.visual_tolerance_pct}%
                                      </Badge>
                                      {row.coverage.coverage_pct < 99.5 ? (
                                        <Badge tone="caution">
                                          {row.coverage.coverage_pct.toFixed(1)}% cov
                                        </Badge>
                                      ) : null}
                                      {!row.coverage.like_for_like ? (
                                        <Badge tone="caution">uneven feeds</Badge>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            ) : null}

                            <td className="px-3 py-2.5">
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-4 w-[3px] shrink-0"
                                  style={{ backgroundColor: meta.color }}
                                />
                                <span className="text-[12.5px] font-medium text-ink-2">
                                  {meta.name}
                                </span>
                              </span>
                            </td>

                            <td className="px-3 py-2.5 text-right">
                              <span className="inline-flex items-center gap-1.5">
                                {nrmseWinner === id ? <WinnerMark /> : null}
                                <span
                                  className={cn(
                                    "readout text-[12.5px]",
                                    nrmseWinner === id ? "font-semibold text-hud" : "text-ink",
                                  )}
                                >
                                  {formatComparisonValue("nrmse_pct", nrmse)}
                                </span>
                              </span>
                            </td>

                            {MATRIX_COLUMNS.map((key) => {
                              const value = model[key] as number | null;
                              const winner = row.winners[key] === id;
                              return (
                                <td key={key} className="px-3 py-2.5 text-right">
                                  <span className="inline-flex items-center gap-1.5">
                                    {winner ? <WinnerMark /> : null}
                                    <span
                                      className={cn(
                                        "readout text-[12.5px]",
                                        winner ? "font-semibold text-hud" : "text-ink-2",
                                      )}
                                    >
                                      {formatMetric(key, value)}
                                    </span>
                                  </span>
                                </td>
                              );
                            })}

                            <td className="readout px-4 py-2.5 text-right text-[12.5px] text-ink-3">
                              {formatInt(model.evaluated_intervals)}
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-line bg-surface-muted px-5 py-3 text-[11.5px] leading-relaxed text-ink-3">
              Band and DSM metrics are state-specific and are not comparable across plants;
              cross-plant accuracy comparisons use capacity-normalised metrics (NRMSE, NMAE,
              Bias %) where applicable. No synthetic overall winner is computed across
              selections.
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Metric picker                                                               */
/* -------------------------------------------------------------------------- */

function MetricPicker({
  value,
  onChange,
}: {
  value: ComparisonMetricKey;
  onChange: (next: ComparisonMetricKey) => void;
}) {
  const current = COMPARISON_METRICS.find((m) => m.key === value) ?? COMPARISON_METRICS[0];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex h-8 items-center gap-2 rounded-[3px] border border-line-hud bg-tint px-2.5 text-[11px] font-semibold tracking-[0.08em] text-hud uppercase transition-colors hover:bg-tint-strong">
          {current.label}
          <ChevronDown className="size-3.5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[280px] rounded-[3px] border border-line bg-surface p-1.5 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.85)]"
        >
          {COMPARISON_METRICS.map((m) => {
            const def = METRIC_CATALOG[m.catalogKey];
            const active = m.key === value;
            const comparable = isCrossPlantComparable(m.key);
            return (
              <DropdownMenu.Item
                key={m.key}
                onSelect={() => onChange(m.key)}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-[2px] px-2.5 py-2 outline-none",
                  "data-[highlighted]:bg-surface-sunken",
                  active && "bg-tint",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-[12px] font-semibold tracking-[0.06em] uppercase",
                        active ? "text-hud" : "text-ink",
                      )}
                    >
                      {m.label}
                    </span>
                    <span className="text-[9.5px] tracking-[0.1em] text-ink-4 uppercase">
                      {comparisonDirection(m.key) === "higher"
                        ? "higher ↑"
                        : comparisonDirection(m.key) === "zero"
                          ? "→ 0"
                          : "lower ↓"}
                    </span>
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-ink-3">
                    {comparable
                      ? "Capacity-normalised — comparable across plants."
                      : def.unit === "MW"
                        ? "Absolute MW — compare within one plant only."
                        : "State-specific band basis — within one plant only."}
                  </span>
                </span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
