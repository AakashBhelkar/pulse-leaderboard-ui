"use client";

import { useState } from "react";
import { BAND_COLORS } from "@/lib/config/models";
import { BandBars } from "./band-bars";
import type { EvaluationSummary } from "@/lib/types";
import { Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { MetricTooltip } from "@/components/metrics/metric-tooltip";
import { formatInt } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Official band distribution across the WHOLE selected range.
 *
 * The previous prototype showed single-day block counts against a 13-day range.
 * Here the denominator is stated in the header and rendered from
 * `coverage.eligible_intervals`, so the two can never drift apart (PRD App. A).
 */
export function BandDistribution({
  summary,
  isPending,
}: {
  summary?: EvaluationSummary;
  isPending?: boolean;
}) {
  const [mode, setMode] = useState<"count" | "share">("count");

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-1.5">
            Official band distribution
            <MetricTooltip
              metric="band_dist"
              evaluatedIntervals={summary?.coverage.eligible_intervals}
              bandBasis={summary?.models[0]?.band_basis}
            >
              <span className="cursor-help text-ink-4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="7.6" r="1.15" fill="currentColor" />
                </svg>
              </span>
            </MetricTooltip>
          </span>
        }
        subtitle={
          summary
            ? `All ${formatInt(summary.coverage.eligible_intervals)} eligible intervals across ${summary.coverage.days} ${summary.coverage.days === 1 ? "day" : "days"} · deviation measured against each block's Actual`
            : undefined
        }
        actions={
          <div className="flex rounded-lg border border-line-strong bg-surface-sunken p-0.5">
            {(["count", "share"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-[6px] px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  mode === m ? "bg-white text-ink shadow-[0_1px_2px_rgba(16,34,27,0.08)]" : "text-ink-3",
                )}
              >
                {m === "count" ? "Blocks" : "Share"}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex-1 px-3 pb-2">
        {isPending || !summary ? (
          <Skeleton className="h-[248px] rounded-lg" />
        ) : (
          <BandBars summary={summary} mode={mode} height={248} />
        )}
      </div>

      {summary ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line bg-surface-muted px-5 py-2.5 text-[11.5px] text-ink-3">
          {summary.plant.official_band_thresholds.map((t, i, all) => (
            <span key={t.band} className="flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-[3px]"
                style={{ backgroundColor: BAND_COLORS[t.band] }}
              />
              Band {t.band}{" "}
              <span className="text-ink-4">
                {t.upto_pct === null
                  ? `> ${all[i - 1]?.upto_pct}%`
                  : i === 0
                    ? `≤ ${t.upto_pct}%`
                    : `${all[i - 1]?.upto_pct}–${t.upto_pct}%`}
              </span>
            </span>
          ))}
          <span className="text-ink-4">deviation as % of the block&apos;s Actual generation</span>
        </div>
      ) : null}
    </Card>
  );
}
