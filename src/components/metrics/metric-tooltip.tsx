"use client";

import type { ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import {
  BAND_BASIS_TEXT,
  DSM_BASIS_TEXT,
  METRIC_CATALOG,
  directionText,
} from "@/lib/config/metric-catalog";
import type { BandBasis, DsmBasis } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { formatInt } from "@/lib/utils/format";

/**
 * The one canonical metric explanation surface (PRD §11.2).
 *
 * Cards, table headers, chart legends and the reference dialog all render this
 * component, so a metric can never be described two different ways.
 */
export interface MetricTooltipProps {
  metric: keyof typeof METRIC_CATALOG;
  /** The value being explained, already formatted. */
  value?: string;
  /** Denominator disclosure — always shown when the metric has one. */
  evaluatedIntervals?: number;
  dsmBasis?: DsmBasis | null;
  bandBasis?: BandBasis | null;
  extra?: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  asChild?: boolean;
}

export function MetricTooltip({
  metric,
  value,
  evaluatedIntervals,
  dsmBasis,
  bandBasis,
  extra,
  children,
  side = "top",
  className,
  asChild = true,
}: MetricTooltipProps) {
  const def = METRIC_CATALOG[metric];
  if (!def) return <>{children}</>;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild={asChild} className={className}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={8}
          collisionPadding={16}
          className={cn(
            "z-50 w-[320px] rounded-xl bg-masthead p-3.5 text-[12.5px] leading-relaxed text-ondark shadow-[0_16px_44px_-12px_rgba(7,26,19,0.55)]",
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-semibold text-white">{def.label}</span>
            {value ? (
              <span className="tnum text-[13px] font-semibold text-warn">{value}</span>
            ) : null}
          </div>

          <p className="mt-1.5 text-ondark-2">{def.plain}</p>

          {def.formula ? (
            <div className="mt-2 rounded-md bg-black/30 px-2 py-1.5 font-mono text-[11.5px] text-warn">
              {def.formula}
            </div>
          ) : null}

          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ondark-3">
            <span>
              <span className="text-ondark-4">Direction · </span>
              {directionText(def.direction)}
            </span>
            {typeof evaluatedIntervals === "number" ? (
              <span>
                <span className="text-ondark-4">Evaluated on · </span>
                {formatInt(evaluatedIntervals)} intervals
              </span>
            ) : null}
          </div>

          {def.caveat ? (
            <p className="mt-2 border-t border-white/10 pt-2 text-[11.5px] text-warn">
              {def.caveat}
            </p>
          ) : null}

          {dsmBasis ? (
            <p className="mt-2 border-t border-white/10 pt-2 text-[11.5px] text-warn">
              <span className="font-semibold">{DSM_BASIS_TEXT[dsmBasis].label}: </span>
              {DSM_BASIS_TEXT[dsmBasis].text}
            </p>
          ) : null}

          {bandBasis ? (
            <p className="mt-2 border-t border-white/10 pt-2 text-[11.5px] text-warn">
              <span className="font-semibold">{BAND_BASIS_TEXT[bandBasis].label}: </span>
              {BAND_BASIS_TEXT[bandBasis].text}
            </p>
          ) : null}

          {extra ? (
            <div className="mt-2 border-t border-white/10 pt-2 text-[11.5px] text-ondark-2">
              {extra}
            </div>
          ) : null}

          <div className="mt-2.5 flex items-center gap-1.5 border-t border-white/10 pt-2 text-[10.5px] tracking-wide text-ondark-4 uppercase">
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                def.authority === "backend" ? "bg-brand-400" : "bg-accent-400",
              )}
            />
            {def.authority === "backend"
              ? "Backend-authoritative value"
              : "Frontend visual aid — not a scored metric"}
          </div>

          <Tooltip.Arrow className="fill-masthead" width={11} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** Small ⓘ affordance for headers and labels. */
export function InfoIcon({ className }: { className?: string }) {
  return (
    <Info
      className={cn(
        "inline-block size-3.5 shrink-0 cursor-help text-ink-4 transition-colors hover:text-hud",
        className,
      )}
      strokeWidth={2}
      aria-hidden="true"
    />
  );
}

/** Convenience wrapper: a metric label plus its info affordance. */
export function MetricLabel({
  metric,
  children,
  evaluatedIntervals,
  dsmBasis,
  bandBasis,
  className,
  side,
}: {
  metric: keyof typeof METRIC_CATALOG;
  children?: ReactNode;
  evaluatedIntervals?: number;
  dsmBasis?: DsmBasis | null;
  bandBasis?: BandBasis | null;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const def = METRIC_CATALOG[metric];
  return (
    <MetricTooltip
      metric={metric}
      evaluatedIntervals={evaluatedIntervals}
      dsmBasis={dsmBasis}
      bandBasis={bandBasis}
      side={side}
    >
      <span
        className={cn(
          "inline-flex cursor-help items-center gap-1 outline-offset-2",
          className,
        )}
        tabIndex={0}
        role="button"
        aria-label={`${def.label} — show definition`}
      >
        {children ?? def.label}
        <InfoIcon />
      </span>
    </MetricTooltip>
  );
}
