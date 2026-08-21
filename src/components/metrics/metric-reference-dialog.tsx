"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { BookOpen, X } from "lucide-react";
import {
  BAND_BASIS_TEXT,
  DSM_BASIS_TEXT,
  METRIC_CATALOG,
  directionText,
} from "@/lib/config/metric-catalog";
import { Button } from "@/components/ui/primitives";

const ORDER = [
  "rmse_mw",
  "mae_mw",
  "bias_mw",
  "band_a_pct",
  "outside_band_a_pct",
  "estimated_dsm_impact_pct",
  "coverage",
  "eligible",
  "visual_tolerance",
];

/** Full metric reference. Same wording as the hover cards — one source. */
export function MetricReferenceDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="ghost">
          <BookOpen className="size-3.5" />
          Metric reference
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-brand-950/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[86vh] w-[min(720px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_40px_90px_-24px_rgba(0,0,0,0.9)]">
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <Dialog.Title className="text-[17px] font-semibold tracking-[-0.015em] text-ink">
                Metric reference
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12.5px] text-ink-3">
                Every definition here is the same text shown on hover throughout the
                workspace.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-lg p-1.5 text-ink-4 transition-colors hover:bg-canvas-deep hover:text-ink"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="scrollbar-slim flex-1 overflow-y-auto px-6 py-5">
            <dl className="space-y-5">
              {ORDER.map((key) => {
                const def = METRIC_CATALOG[key];
                if (!def) return null;
                return (
                  <div key={key} className="border-b border-line-soft pb-5 last:border-0 last:pb-0">
                    <dt className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[14px] font-semibold text-ink">{def.label}</span>
                      <span className="rounded bg-surface-sunken px-1.5 py-[2px] text-[10.5px] font-medium text-ink-3">
                        {directionText(def.direction)}
                      </span>
                      <span
                        className={
                          def.authority === "backend"
                            ? "rounded bg-tint px-1.5 py-[2px] text-[10.5px] font-medium text-hud"
                            : "rounded bg-warn-tint px-1.5 py-[2px] text-[10.5px] font-medium text-warn"
                        }
                      >
                        {def.authority === "backend" ? "Backend-authoritative" : "Visual aid only"}
                      </span>
                    </dt>
                    <dd className="mt-2 text-[13px] leading-relaxed text-ink-2">{def.plain}</dd>
                    {def.formula ? (
                      <dd className="mt-2 rounded-md bg-surface-sunken px-2.5 py-1.5 font-mono text-[11.5px] text-ink-2">
                        {def.formula}
                      </dd>
                    ) : null}
                    {def.caveat ? (
                      <dd className="mt-2 border-l-2 border-line-warn pl-3 text-[12px] leading-relaxed text-warn">
                        {def.caveat}
                      </dd>
                    ) : null}
                  </div>
                );
              })}
            </dl>

            <div className="mt-6 rounded-xl border border-line bg-surface-sunken p-4">
              <h3 className="text-[13px] font-semibold text-ink">
                How this prototype qualifies its numbers
              </h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
                <span className="font-semibold">Band classification · </span>
                {BAND_BASIS_TEXT.simulated_model_as_schedule.text}
              </p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
                <span className="font-semibold">DSM impact · </span>
                {DSM_BASIS_TEXT.simulated_model_attribution.text}
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
