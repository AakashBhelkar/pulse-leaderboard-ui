"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronsUpDown, Factory } from "lucide-react";
import { PLANT_LIST } from "@/lib/config/plants";
import { usePlant, useWorkspace } from "./workspace-context";
import { cn } from "@/lib/utils/cn";

export function PlantPicker() {
  const plant = usePlant();
  const { setPlant } = useWorkspace();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="group flex h-[46px] items-center gap-3 rounded-[11px] border border-line-strong bg-surface pr-3 pl-3.5 transition-all hover:border-brand-400 hover:shadow-[0_1px_3px_rgba(16,34,27,0.08)]"
          aria-label={`Plant: ${plant.name}. Change plant`}
        >
          <span className="grid size-7 place-items-center rounded-lg bg-tint text-hud">
            <Factory className="size-3.5" strokeWidth={2.2} />
          </span>
          <span className="text-left leading-none">
            <span className="block text-[10px] font-semibold tracking-[0.08em] text-ink-4 uppercase">
              Plant
            </span>
            <span className="mt-1 block text-[14px] font-semibold tracking-[-0.01em] text-ink">
              {plant.name}
              <span className="ml-1.5 font-normal text-ink-3">
                {plant.capacity_mw} MW · {plant.state_short}
              </span>
            </span>
          </span>
          <ChevronsUpDown className="ml-1 size-3.5 text-ink-4 transition-colors group-hover:text-hud" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[330px] rounded-xl border border-line bg-surface p-1.5 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.85)]"
        >
          <p className="px-2.5 pt-1.5 pb-2 text-[10px] font-semibold tracking-[0.08em] text-ink-4 uppercase">
            Evaluation subject
          </p>
          {PLANT_LIST.map((p) => {
            const active = p.id === plant.id;
            return (
              <DropdownMenu.Item
                key={p.id}
                onSelect={() => setPlant(p.id)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5 outline-none",
                  "data-[highlighted]:bg-canvas-deep",
                  active && "bg-tint data-[highlighted]:bg-tint",
                )}
              >
                <span
                  className={cn(
                    "mt-[3px] grid size-4 shrink-0 place-items-center rounded-full border",
                    active ? "border-hud bg-hud" : "border-line-strong",
                  )}
                >
                  {active ? <Check className="size-2.5 text-white" strokeWidth={3.5} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-ink">{p.name}</span>
                    <span className="tnum text-[12px] text-ink-3">{p.capacity_mw} MW</span>
                  </span>
                  <span className="mt-1 block text-[11.5px] leading-snug text-ink-3">
                    {p.state} · official bands {p.official_bands[0]}–
                    {p.official_bands[p.official_bands.length - 1]} · Band A ±
                    {p.visual_tolerance_pct}%
                  </span>
                </span>
              </DropdownMenu.Item>
            );
          })}
          <p className="mt-1 border-t border-line px-2.5 pt-2 pb-1.5 text-[11px] leading-snug text-ink-4">
            Switching plants reloads metrics and re-sizes the chart tolerance envelope from
            that plant&apos;s configuration.
          </p>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
