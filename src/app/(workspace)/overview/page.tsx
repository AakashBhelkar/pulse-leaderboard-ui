"use client";

import Link from "next/link";
import { GitCompareArrows } from "lucide-react";
import { PLANT_LIST } from "@/lib/config/plants";
import { PlantPanel } from "@/components/fleet/plant-panel";
import { FleetScoreboard } from "@/components/fleet/fleet-scoreboard";
import { DsmCounterfactual } from "@/components/fleet/dsm-counterfactual";
import { motion } from "motion/react";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { diffDays, formatRange } from "@/lib/utils/date";
import { formatInt } from "@/lib/utils/format";

/**
 * Fleet overview — every plant's winners and forecast evidence on one screen,
 * with a way through to each plant's detailed monitor.
 *
 * DESIGN PILOT: this page uses the page-scoped `fx-` treatment from globals.css.
 * Nothing here is shared with another view, so the treatment can be adopted
 * fleet-wide or dropped without touching the rest of the workspace.
 */
export default function FleetOverviewPage() {
  const { from, to, scenario } = useWorkspace();

  const totalCapacity = PLANT_LIST.reduce((sum, p) => sum + p.capacity_mw, 0);
  const days = diffDays(from, to) + 1;
  const compareHref = `/compare?from=${from}&to=${to}&scenario=${scenario}`;

  return (
    <div className="space-y-5">
      {/* Page head, over the one decorative surface on the page. */}
      <header className="fx-dawn relative -mx-5 -mt-5 overflow-hidden px-5 pt-7 pb-7 lg:-mx-7 lg:-mt-6 lg:px-7">
        <span aria-hidden="true" className="fx-graticule pointer-events-none absolute inset-0" />
        <div className="relative">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="flex items-center gap-2.5 text-[10px] leading-none font-semibold tracking-[0.18em] text-ink-4 uppercase">
              Fleet overview
              <span aria-hidden="true" className="h-px w-10 bg-line-strong" />
            </p>

            <h1 className="mt-4 text-[40px] leading-none font-semibold tracking-[-0.035em] text-ink">
              All plants
            </h1>

            <dl className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Metric label="Plants" value={String(PLANT_LIST.length)} />
              <Rule />
              <Metric label="Installed" value={`${totalCapacity} MW`} />
              <Rule />
              <Metric label="Period" value={formatRange(from, to)} />
              <Rule />
              <Metric
                label="Expected blocks"
                value={formatInt(days * 96 * PLANT_LIST.length)}
              />
            </dl>
          </div>

          <Link
            href={compareHref}
            className="group inline-flex h-10 items-center gap-2 rounded-full bg-accent-400 pr-4 pl-4.5 text-[13px] font-medium text-brand-900 shadow-[0_1px_2px_rgba(154,100,16,0.22)] transition-colors hover:bg-accent-300"
          >
            <GitCompareArrows className="size-4" />
            Compare selections
          </Link>
        </div>

        <div className="fx-ticks mt-5 w-full opacity-70" aria-hidden="true" />

        <p className="mt-4 max-w-[86ch] text-[12.5px] leading-relaxed text-ink-3">
          Winners are resolved independently per metric within each plant — nothing is
          combined into a fleet score, and raw MW errors are never compared between plants
          of different size. The period selector applies to every plant below.
        </p>
        </div>
      </header>

      {/* Side by side only where the scoreboard clears its own table width: six
          columns need ~865px, which the 1.35fr share does not reach until the
          viewport is about 1600px. Below that both panels take the full row
          rather than one of them scrolling sideways. */}
      <div className="grid gap-5 min-[1600px]:grid-cols-[1.35fr_1fr]">
        <FleetScoreboard from={from} to={to} scenario={scenario} />
        <DsmCounterfactual from={from} to={to} scenario={scenario} />
      </div>

      <div className="space-y-5">
        {PLANT_LIST.map((plant, i) => (
          <motion.div
            key={plant.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.06 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
          >
            <PlantPanel plant={plant} from={from} to={to} scenario={scenario} />
          </motion.div>
        ))}
      </div>

      <p className="px-1 pb-1 text-[11.5px] leading-relaxed text-ink-4">
        Band and DSM figures are state-specific and are not comparable between plants.
        Capacity-normalised NRMSE is shown for that purpose, and is the default throughout
        the comparison workspace.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] leading-none tracking-[0.14em] text-ink-4 uppercase">
        {label}
      </dt>
      <dd className="fx-figure mt-2 text-[20px] leading-none text-ink">{value}</dd>
    </div>
  );
}

function Rule() {
  return <span aria-hidden="true" className="h-8 w-px bg-line" />;
}
