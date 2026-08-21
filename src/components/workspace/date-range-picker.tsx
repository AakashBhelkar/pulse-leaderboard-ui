"use client";

import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { CalendarDays, ChevronsUpDown } from "lucide-react";
import { usePlant, useWorkspace } from "./workspace-context";
import { Button } from "@/components/ui/primitives";
import {
  addDays,
  dayToLocalDate,
  diffDays,
  formatDay,
  formatRange,
  localDateToDay,
  MAX_RANGE_DAYS,
} from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

/** Presets keep the default one-day view one click away (PRD §12). */
function presetsFor(latest: string) {
  return [
    { id: "d1", label: "Latest day", from: latest, to: latest, hint: "96 blocks" },
    { id: "d3", label: "Last 3 days", from: addDays(latest, -2), to: latest, hint: "288 blocks" },
    { id: "d7", label: "Last 7 days", from: addDays(latest, -6), to: latest, hint: "672 blocks" },
    { id: "d13", label: "Last 13 days", from: addDays(latest, -12), to: latest, hint: "1,248 blocks" },
    {
      id: "d30",
      label: `Last ${MAX_RANGE_DAYS} days`,
      from: addDays(latest, -(MAX_RANGE_DAYS - 1)),
      to: latest,
      hint: `${(MAX_RANGE_DAYS * 96).toLocaleString("en-IN")} blocks · max`,
    },
  ];
}

const toDate = dayToLocalDate;

export function DateRangePicker() {
  const plant = usePlant();
  const { from, to, setRange } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();

  // Seeded when the popover opens rather than in an effect, so editing the
  // draft never fights a re-sync on re-render.
  function handleOpenChange(next: boolean) {
    if (next) setDraft({ from: toDate(from), to: toDate(to) });
    setOpen(next);
  }

  const presets = useMemo(() => presetsFor(plant.data_to), [plant.data_to]);
  const days = diffDays(from, to) + 1;
  const draftDays =
    draft?.from && draft.to
      ? diffDays(localDateToDay(draft.from), localDateToDay(draft.to)) + 1
      : 0;
  const activePreset = presets.find((p) => p.from === from && p.to === to);

  function commit(nextFrom: string, nextTo: string, anchor: "from" | "to" = "to") {
    setRange(nextFrom, nextTo, anchor);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          className="group flex h-[46px] items-center gap-3 rounded-[11px] border border-line-strong bg-surface pr-3 pl-3.5 transition-all hover:border-brand-400 hover:shadow-[0_1px_3px_rgba(16,34,27,0.08)]"
          aria-label={`Date range: ${formatRange(from, to)}. Change range`}
        >
          <span className="grid size-7 place-items-center rounded-lg bg-warn-tint text-warn">
            <CalendarDays className="size-3.5" strokeWidth={2.2} />
          </span>
          <span className="text-left leading-none">
            <span className="block text-[10px] font-semibold tracking-[0.08em] text-ink-4 uppercase">
              Period
            </span>
            <span className="tnum mt-1 block text-[14px] font-semibold tracking-[-0.01em] text-ink">
              {formatRange(from, to)}
              <span className="ml-1.5 font-normal text-ink-3">
                {days} {days === 1 ? "day" : "days"}
              </span>
            </span>
          </span>
          <ChevronsUpDown className="ml-1 size-3.5 text-ink-4 transition-colors group-hover:text-hud" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className="z-50 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_20px_52px_-14px_rgba(0,0,0,0.85)]"
        >
          <div className="flex flex-col sm:flex-row">
            <div className="border-line p-2 sm:w-[188px] sm:border-r">
              <p className="px-2 pt-1.5 pb-2 text-[10px] font-semibold tracking-[0.08em] text-ink-4 uppercase">
                Quick ranges
              </p>
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => commit(p.from, p.to)}
                  className={cn(
                    "flex w-full items-baseline justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                    activePreset?.id === p.id
                      ? "bg-tint text-hud"
                      : "text-ink-2 hover:bg-canvas-deep",
                  )}
                >
                  <span className="text-[12.5px] font-medium">{p.label}</span>
                  <span className="tnum text-[10.5px] text-ink-4">{p.hint}</span>
                </button>
              ))}
              <p className="mt-2 border-t border-line px-2.5 pt-2 text-[11px] leading-snug text-ink-4">
                Data available {formatDay(plant.data_from)} – {formatDay(plant.data_to)}.
                <br />
                <span className="text-ink-3">
                  Up to {MAX_RANGE_DAYS} days per selection.
                </span>
              </p>
            </div>

            <div className="p-3">
              <DayPicker
                mode="range"
                numberOfMonths={1}
                defaultMonth={toDate(to)}
                selected={draft}
                onSelect={setDraft}
                disabled={{ before: toDate(plant.data_from), after: toDate(plant.data_to) }}
                startMonth={toDate(plant.data_from)}
                endMonth={toDate(plant.data_to)}
                showOutsideDays={false}
              />

              <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-3">
                <p className="tnum text-[11.5px] text-ink-3">
                  {draftDays > MAX_RANGE_DAYS ? (
                    <span className="text-warn">
                      {draftDays} days — will trim to {MAX_RANGE_DAYS}
                    </span>
                  ) : draft?.from
                    ? `${formatDay(localDateToDay(draft.from))} → ${
                        draft.to ? formatDay(localDateToDay(draft.to)) : "…"
                      }`
                    : "Pick a start date"}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!draft?.from}
                    onClick={() => {
                      if (!draft?.from) return;
                      const start = localDateToDay(draft.from);
                      const end = draft.to ? localDateToDay(draft.to) : start;
                      commit(start, end);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
