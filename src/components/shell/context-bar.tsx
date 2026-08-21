"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { GitCompareArrows, LayersIcon, Network } from "lucide-react";
import { PlantPicker } from "@/components/workspace/plant-picker";
import { DateRangePicker } from "@/components/workspace/date-range-picker";
import { usePlant, useWorkspace } from "@/components/workspace/workspace-context";
import { useDayDetail, useSummary } from "@/lib/api/queries";
import { MetricTooltip } from "@/components/metrics/metric-tooltip";
import { Button, Skeleton } from "@/components/ui/primitives";
import { PLANT_LIST } from "@/lib/config/plants";
import { TOLERANCE_COLOR } from "@/lib/config/models";
import { formatInt, formatPct } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function ContextBar() {
  const pathname = usePathname();
  const params = useSearchParams();
  // The fleet overview spans every plant, so a single-plant selector and a
  // single-plant coverage readout would both be misleading there.
  const fleetScope = pathname === "/overview";
  /* On the day view the reader is looking at one day inside the period, so the
     chip must report that day's coverage — a period figure beside a day-scoped
     page reads as two contradictory numbers for the same thing. */
  const dayScope = pathname === "/monitor";
  const dayParam = params.get("date");

  return (
    <div className="border-b border-line bg-surface-muted">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2.5 px-5 py-3 lg:px-7">
        {fleetScope ? <FleetChip /> : <PlantPicker />}
        <DateRangePicker />

        <Link href={params.toString() ? `/compare?${params.toString()}` : "/compare"}>
          <Button variant="accent" size="md" className="h-[46px] px-4">
            <GitCompareArrows className="size-4" />
            Compare
          </Button>
        </Link>

        <div className="ml-auto flex items-center gap-2.5">
          <ToleranceChip fleetScope={fleetScope} />
          {fleetScope ? null : (
            <CoverageChip dayScoped={dayScope && !!dayParam && dayParam !== "all"} date={dayParam} />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
  tone = "neutral",
  className,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  tone?: "neutral" | "warn";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-[46px] items-center gap-3 rounded-[3px] border px-3.5",
        tone === "warn" ? "border-line-warn bg-warn-tint" : "border-line bg-surface",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-[2px]",
          tone === "warn" ? "bg-warn-tint text-warn" : "bg-tint text-hud",
        )}
      >
        {icon}
      </span>
      <span className="leading-none">
        <span className="block text-[9.5px] font-semibold tracking-[0.16em] text-ink-4 uppercase">
          {label}
        </span>
        <span className="mt-1.5 block">{children}</span>
      </span>
    </div>
  );
}

function FleetChip() {
  const total = PLANT_LIST.reduce((s, p) => s + p.capacity_mw, 0);
  return (
    <Field icon={<Network className="size-3.5" strokeWidth={2.2} />} label="Scope">
      <span className="readout text-[14px] font-semibold text-ink">
        All plants
        <span className="ml-2 font-normal text-ink-3">
          {PLANT_LIST.length} · {total} MW
        </span>
      </span>
    </Field>
  );
}

function CoverageChip({
  dayScoped,
  date,
}: {
  dayScoped: boolean;
  date: string | null;
}) {
  const { scope, to } = useWorkspace();
  const target = date && date !== "all" ? date : to;
  const range = useSummary(scope);
  const day = useDayDetail(scope, target, dayScoped);
  const source = dayScoped ? day : range;
  const { isPending, isError } = source;
  const coverage = source.data?.coverage;

  if (isPending) return <Skeleton className="h-[46px] w-[220px]" />;
  if (isError || !coverage) return null;

  const complete = coverage.coverage_pct >= 99.5;

  return (
    <MetricTooltip
      metric="coverage"
      value={formatPct(coverage.coverage_pct)}
      extra={
        <>
          {formatInt(coverage.eligible_intervals)} of these are eligible for scoring.{" "}
          {coverage.eligibility_rule}
        </>
      }
      side="bottom"
    >
      <div className="cursor-help">
        <Field
          icon={<LayersIcon className="size-3.5" strokeWidth={2.2} />}
          label={dayScoped ? "Coverage · this day" : "Actual coverage"}
          tone={complete ? "neutral" : "warn"}
        >
          <span className="readout text-[14px] font-semibold text-ink">
            {formatInt(coverage.actual_available_intervals)}
            <span className="text-ink-4">/</span>
            {formatInt(coverage.expected_intervals)}
            <span className="ml-2 font-normal text-ink-3">
              {formatPct(coverage.coverage_pct)}
            </span>
          </span>
        </Field>
      </div>
    </MetricTooltip>
  );
}

function ToleranceChip({ fleetScope }: { fleetScope: boolean }) {
  const plant = usePlant();
  const label = fleetScope
    ? PLANT_LIST.map((p) => `±${p.visual_tolerance_pct}%`).join(" / ")
    : `±${plant.visual_tolerance_pct}%`;

  return (
    <MetricTooltip metric="visual_tolerance" value={label} side="bottom">
      <div className="hidden cursor-help lg:block">
        <Field
          icon={
            <span
              className="h-3.5 w-4 rounded-[1px]"
              style={{
                backgroundColor: `${TOLERANCE_COLOR}33`,
                border: `1px solid ${TOLERANCE_COLOR}80`,
              }}
            />
          }
          label="Band A boundary"
        >
          <span className="readout text-[14px] font-semibold text-ink">
            {label}
            <span className="ml-2 text-[11px] font-normal tracking-[0.08em] text-ink-4 uppercase">
              visual aid
            </span>
          </span>
        </Field>
      </div>
    </MetricTooltip>
  );
}
