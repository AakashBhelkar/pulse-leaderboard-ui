"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DayPicker, type DateRange } from "react-day-picker";
import { CalendarDays, Check, ChevronDown, Trash2 } from "lucide-react";
import { PLANTS, PLANT_LIST } from "@/lib/config/plants";
import type { CompareSelection, PlantId } from "@/lib/types";
import { Button } from "@/components/ui/primitives";
import {
  clampRange,
  dayToLocalDate,
  diffDays,
  formatDay,
  formatRange,
  localDateToDay,
} from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

/** One row of the compare builder: plant + period, edited in place. */
export function SelectionEditor({
  selection,
  index,
  canRemove,
  onChange,
  onRemove,
  accent,
  varies,
  sharedEditable,
}: {
  selection: CompareSelection;
  index: number;
  canRemove: boolean;
  onChange: (next: CompareSelection) => void;
  onRemove: () => void;
  accent: string;
  /**
   * Which dimension this row is allowed to vary. The other one is fixed for the
   * whole comparison and shown read-only, so "different plant over a different
   * period" — a combination with no meaningful reading — cannot be built.
   */
  varies: "plant" | "period";
  /**
   * True on the row that owns the shared dimension. It stays editable there —
   * one place, applying to every row — and is read-only everywhere else.
   */
  sharedEditable?: boolean;
}) {
  const plant = PLANTS[selection.plant_id];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft({
        from: dayToLocalDate(selection.from),
        to: dayToLocalDate(selection.to),
      });
    }
    setOpen(next);
  }

  function setPlant(id: PlantId) {
    const target = PLANTS[id];
    const period = clampRange(selection.from, selection.to, {
      min: target.data_from,
      max: target.data_to,
    });
    onChange({ ...selection, plant_id: id, from: period.from, to: period.to });
  }

  const days = diffDays(selection.from, selection.to) + 1;

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-line bg-surface px-3 py-2.5">
      <span
        className="grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
        style={{ backgroundColor: accent }}
      >
        {index + 1}
      </span>

      {/* Plant */}
      {varies === "period" && !sharedEditable ? (
        <span className="flex h-9 items-center gap-2 rounded-lg border border-transparent bg-transparent px-3">
          <span className="text-[13px] font-semibold text-ink">{plant.name}</span>
          <span className="text-[11.5px] text-ink-3">
            {plant.capacity_mw} MW · {plant.state_short}
          </span>
        </span>
      ) : (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface-sunken px-3 transition-colors hover:border-hud">
            <span className="text-[13px] font-semibold text-ink">{plant.name}</span>
            <span className="text-[11.5px] text-ink-3">
              {plant.capacity_mw} MW · {plant.state_short}
            </span>
            <ChevronDown className="size-3.5 text-ink-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-50 w-[260px] rounded-xl border border-line bg-surface p-1.5 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.85)]"
          >
            {PLANT_LIST.map((p) => (
              <DropdownMenu.Item
                key={p.id}
                onSelect={() => setPlant(p.id)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-canvas-deep"
              >
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full border",
                    p.id === plant.id ? "border-hud bg-hud" : "border-line-strong",
                  )}
                >
                  {p.id === plant.id ? (
                    <Check className="size-2.5 text-white" strokeWidth={3.5} />
                  ) : null}
                </span>
                <span className="text-[13px] font-medium text-ink">{p.name}</span>
                <span className="ml-auto text-[11.5px] text-ink-3">
                  ±{p.visual_tolerance_pct}%
                </span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      )}

      {/* Period */}
      {varies === "plant" && !sharedEditable ? (
        <span className="flex h-9 items-center gap-2 rounded-lg px-3">
          <CalendarDays className="size-3.5 text-ink-4" />
          <span className="tnum text-[13px] font-medium text-ink">
            {formatRange(selection.from, selection.to)}
          </span>
          <span className="text-[11.5px] text-ink-3">
            {days} {days === 1 ? "day" : "days"}
          </span>
        </span>
      ) : (
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>
          <button className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface-sunken px-3 transition-colors hover:border-hud">
            <CalendarDays className="size-3.5 text-warn" />
            <span className="tnum text-[13px] font-medium text-ink">
              {formatRange(selection.from, selection.to)}
            </span>
            <span className="text-[11.5px] text-ink-3">
              {days} {days === 1 ? "day" : "days"}
            </span>
            <ChevronDown className="size-3.5 text-ink-4" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={16}
            className="z-50 rounded-xl border border-line bg-surface p-3 shadow-[0_20px_52px_-14px_rgba(0,0,0,0.85)]"
          >
            <DayPicker
              mode="range"
              numberOfMonths={1}
              defaultMonth={dayToLocalDate(selection.to)}
              selected={draft}
              onSelect={setDraft}
              disabled={{
                before: dayToLocalDate(plant.data_from),
                after: dayToLocalDate(plant.data_to),
              }}
              startMonth={dayToLocalDate(plant.data_from)}
              endMonth={dayToLocalDate(plant.data_to)}
              showOutsideDays={false}
            />
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-3">
              <p className="text-[11.5px] text-ink-3">
                {formatDay(plant.data_from)} – {formatDay(plant.data_to)} available
              </p>
              <Button
                size="sm"
                variant="primary"
                disabled={!draft?.from}
                onClick={() => {
                  if (!draft?.from) return;
                  const start = localDateToDay(draft.from);
                  const end = draft.to ? localDateToDay(draft.to) : start;
                  const period = clampRange(
                    start,
                    end,
                    { min: plant.data_from, max: plant.data_to },
                    "from",
                  );
                  onChange({ ...selection, from: period.from, to: period.to });
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      )}

      <button
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove selection ${index + 1}`}
        className="ml-auto rounded-lg p-2 text-ink-4 transition-colors hover:bg-canvas-deep hover:text-negative disabled:pointer-events-none disabled:opacity-30"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
