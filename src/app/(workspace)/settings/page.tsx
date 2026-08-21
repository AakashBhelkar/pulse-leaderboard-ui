"use client";

import { Check, FlaskConical, Palette, Plug, ShieldAlert } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { SCENARIO_LIST, type ScenarioId } from "@/lib/mock/scenarios";
import { PLANT_LIST } from "@/lib/config/plants";
import { MODEL_LIST, ACTUAL_COLOR, TOLERANCE_COLOR } from "@/lib/config/models";
import { MetricReferenceDialog } from "@/components/metrics/metric-reference-dialog";
import { ModelLogo } from "@/components/brand/model-logo";
import { PipelineMonitor } from "@/components/pipeline/pipeline-monitor";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import type { ModelId } from "@/lib/types";
import { formatDay } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

const GROUP_LABELS: Record<string, { title: string; blurb: string }> = {
  conditions: {
    title: "Operating conditions",
    blurb: "Weather regimes that change how far the models diverge from Actual.",
  },
  "data quality": {
    title: "Data quality",
    blurb: "Incomplete telemetry and uneven model feeds — the cases that break naive dashboards.",
  },
  "system state": {
    title: "System state",
    blurb: "How the workspace behaves when the evaluation service misbehaves.",
  },
};

export default function SettingsPage() {
  const { scenario, setScenario } = useWorkspace();

  const groups = ["conditions", "data quality", "system state"] as const;

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Workspace settings</p>
        <h1 className="mt-2 text-[22px] leading-none font-semibold tracking-[-0.02em] text-ink">
          Configuration and demonstration controls
        </h1>
        <p className="mt-2 max-w-[76ch] text-[13px] leading-relaxed text-ink-3">
          Plant configuration and model identity are fixed by the backend contract. The
          scenario switcher below exists only while the workspace runs on mock data.
        </p>
      </div>

      {/* Feed health first: it reports on the data everything else is built
          from, and the data-quality scenarios below are the states it surfaces. */}
      <PipelineMonitor />

      {/* Scenario switcher */}
      <Card className="overflow-hidden">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              Data scenario
              <Badge tone="caution">
                <FlaskConical className="size-2.5" />
                Prototype only
              </Badge>
            </span>
          }
          subtitle="Switch the mock service into a specific situation so every state can be walked through in a review."
        />

        <div className="space-y-5 px-5 pb-5">
          {groups.map((group) => {
            const items = SCENARIO_LIST.filter((s) => s.group === group);
            const meta = GROUP_LABELS[group];
            return (
              <div key={group}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-[13px] font-semibold text-ink">{meta.title}</h3>
                  <p className="text-[11.5px] text-ink-3">{meta.blurb}</p>
                </div>
                <div className="mt-2.5 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                  {items.map((item) => {
                    const active = item.id === scenario;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setScenario(item.id as ScenarioId)}
                        aria-pressed={active}
                        className={cn(
                          "group rounded-[12px] border p-3.5 text-left transition-all",
                          active
                            ? "border-hud bg-tint shadow-[0_0_0_1px_var(--color-brand-500)]"
                            : "border-line bg-surface hover:border-line-strong hover:bg-surface-sunken",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "text-[13.5px] font-semibold",
                              active ? "text-hud" : "text-ink",
                            )}
                          >
                            {item.name}
                          </span>
                          <span
                            className={cn(
                              "mt-[2px] grid size-4 shrink-0 place-items-center rounded-full border transition-colors",
                              active
                                ? "border-hud bg-hud"
                                : "border-line-strong group-hover:border-ink-4",
                            )}
                          >
                            {active ? (
                              <Check className="size-2.5 text-white" strokeWidth={3.5} />
                            ) : null}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-2">
                          {item.summary}
                        </p>
                        <p className="mt-2 border-t border-line-soft pt-2 text-[11px] leading-relaxed text-ink-4">
                          <span className="font-semibold text-ink-3">Shows: </span>
                          {item.demonstrates}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-line bg-surface-muted px-5 py-3 text-[11.5px] leading-relaxed text-ink-3">
          The scenario travels as a query parameter to the mock service and is removed
          entirely when the production API is connected. No component reads it directly.
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Plant configuration */}
        <Card className="overflow-hidden">
          <CardHeader
            title="Plant configuration"
            subtitle="Backend-supplied. Drives tolerance sizing, band structure and labels."
          />
          <div className="space-y-3 px-5 pb-5">
            {PLANT_LIST.map((plant) => (
              <div key={plant.id} className="rounded-[12px] border border-line p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold text-ink">{plant.name}</span>
                  <span className="text-[12px] text-ink-3">
                    {plant.state} · commissioned {plant.commissioned}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <Field label="Capacity" value={`${plant.capacity_mw} MW`} />
                  <Field
                    label="Band A tolerance"
                    value={`±${plant.visual_tolerance_pct}%`}
                    hint="of Actual"
                  />
                  <Field
                    label="Official bands"
                    value={`${plant.official_bands[0]}–${plant.official_bands[plant.official_bands.length - 1]}`}
                  />
                  <Field label="Time zone" value="IST" />
                </dl>
                <p className="mt-3 border-t border-line-soft pt-2.5 text-[11.5px] text-ink-4">
                  Data available {formatDay(plant.data_from)} – {formatDay(plant.data_to)} ·
                  band A threshold ±{plant.official_band_thresholds[0].upto_pct}% of Actual
                </p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {/* Colour system */}
          <Card className="overflow-hidden">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Palette className="size-4 text-ink-4" />
                  Visual identity
                </span>
              }
              subtitle="Model colours are locked and never reused for status fills."
              actions={<MetricReferenceDialog />}
            />
            <div className="space-y-2 px-5 pb-5">
              <Swatch color={ACTUAL_COLOR} name="Actual" note="Highest visual weight, drawn above every other series" shape="line" />
              <Swatch
                color={TOLERANCE_COLOR}
                name="Band A band"
                note="Translucent fill around Actual — a visual aid, never labelled Band A"
                shape="fill"
              />
              {MODEL_LIST.map((model) => (
                <Swatch
                  logo={model.brand ? model.id : undefined}
                  key={model.id}
                  color={model.color}
                  name={model.name}
                  note={model.note}
                  shape="line"
                />
              ))}
            </div>
          </Card>

          {/* Data source */}
          <Card className="overflow-hidden">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Plug className="size-4 text-ink-4" />
                  Data source
                </span>
              }
              subtitle="Where the numbers on screen come from today."
            />
            <div className="px-5 pb-5">
              <div className="rounded-[12px] border border-line-warn bg-warn-tint p-3.5">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="mt-[1px] size-4 shrink-0 text-warn" />
                  <div>
                    <p className="text-[13px] font-semibold text-warn">
                      Simulated evaluation service
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-warn/90">
                      All generation, forecast, band and DSM figures are generated by a
                      deterministic mock. They are physically plausible and stable across
                      refreshes, but they are not plant data.
                    </p>
                  </div>
                </div>
              </div>
              <dl className="mt-3 space-y-2">
                {[
                  ["GET", "/api/plants", "Plant configuration"],
                  ["GET", "/api/evaluation/summary", "Range metrics, coverage, winners"],
                  ["GET", "/api/evaluation/daily", "Per-day evidence"],
                  ["GET", "/api/evaluation/series", "Interval series for the chart"],
                  ["GET", "/api/evaluation/day", "96 blocks for one day"],
                  ["POST", "/api/evaluation/compare", "Multi-selection comparison"],
                ].map(([method, path, purpose]) => (
                  <div
                    key={path}
                    className="flex flex-wrap items-center gap-2 border-b border-line-soft pb-2 last:border-line-danger"
                  >
                    <span className="rounded bg-surface-sunken px-1.5 py-[2px] font-mono text-[10.5px] font-semibold text-ink-3">
                      {method}
                    </span>
                    <span className="font-mono text-[11.5px] text-ink">{path}</span>
                    <span className="ml-auto text-[11.5px] text-ink-4">{purpose}</span>
                  </div>
                ))}
              </dl>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold tracking-[0.06em] text-ink-4 uppercase">
        {label}
      </dt>
      <dd className="tnum mt-1 text-[13px] font-medium text-ink">
        {value}
        {hint ? <span className="ml-1 text-[11px] font-normal text-ink-4">{hint}</span> : null}
      </dd>
    </div>
  );
}

function Swatch({
  color,
  name,
  note,
  shape,
  logo,
}: {
  color: string;
  name: string;
  note: string;
  shape: "line" | "fill";
  /** Vendor brand mark, shown beside the name when one exists. */
  logo?: ModelId;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line-soft px-3 py-2.5">
      {shape === "line" ? (
        <span
          className="mt-[7px] h-[3px] w-7 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : (
        <span
          className="mt-[3px] h-4 w-7 shrink-0 rounded-[3px]"
          style={{ backgroundColor: `${color}2b`, border: `1px solid ${color}80` }}
        />
      )}
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
          {name}
          {logo ? <ModelLogo model={logo} variant="wordmark" height={14} /> : null}
        </p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{note}</p>
      </div>
      <span className="ml-auto font-mono text-[10.5px] text-ink-4">{color}</span>
    </div>
  );
}
