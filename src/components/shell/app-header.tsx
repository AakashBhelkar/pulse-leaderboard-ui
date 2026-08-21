"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LogOut, RadioTower, TriangleAlert } from "lucide-react";
import { VendorLockup } from "@/components/brand/model-logo";
import { SCENARIOS } from "@/lib/mock/scenarios";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/overview", label: "Fleet overview" },
  { href: "/monitor", label: "Plant monitor" },
  { href: "/compare", label: "Comparison" },
  { href: "/settings", label: "Settings" },
];

export function AppHeader() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { scenario } = useWorkspace();
  const [signingOut, setSigningOut] = useState(false);

  const scenarioDef = SCENARIOS[scenario];
  const degraded = scenarioDef.group !== "conditions";

  // Carry the current selection across nav so context is never lost.
  const carry = params.toString();
  const href = (base: string) => (carry ? `${base}?${carry}` : base);

  async function signOut() {
    setSigningOut(true);
    await api.logout().catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-brand-800/60 bg-masthead">
      <div className="mx-auto flex h-[58px] max-w-[1600px] items-center gap-6 px-5 lg:px-7">
        <Link
          href={href("/overview")}
          className="rounded-md"
          aria-label="Solar Forecast Model Leaderboard — fleet overview"
        >
          <VendorLockup height={15} />
        </Link>

        <nav className="ml-2 hidden items-center gap-0.5 md:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={href(item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "text-white"
                    : "text-ondark-3 hover:bg-white/5 hover:text-ondark",
                )}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-3 -bottom-[9px] h-[2px] rounded-full bg-accent-400" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <StatusPill degraded={degraded} label={scenarioDef.name} />

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-1.5 rounded-full border border-white/10 py-1 pr-2 pl-1 transition-colors hover:bg-white/5">
                <span className="grid size-7 place-items-center rounded-full bg-accent-400 text-[11px] font-bold text-brand-900">
                  S
                </span>
                <ChevronDown className="size-3.5 text-ondark-3" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 w-60 rounded-xl border border-line bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(16,34,27,0.28)]"
              >
                <div className="px-2.5 py-2">
                  <p className="text-[13px] font-semibold text-ink">Shared access session</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-3">
                    Prototype workspace · read-only
                  </p>
                </div>
                <div className="my-1 h-px bg-line" />
                <DropdownMenu.Item asChild>
                  <Link
                    href={href("/settings")}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-ink-2 outline-none data-[highlighted]:bg-canvas-deep data-[highlighted]:text-ink"
                  >
                    Workspace settings
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={signOut}
                  disabled={signingOut}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-ink-2 outline-none data-[highlighted]:bg-canvas-deep data-[highlighted]:text-ink"
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Mobile nav */}
      <nav
        className="scrollbar-slim flex items-center gap-1 overflow-x-auto border-t border-white/[0.07] px-4 py-1.5 md:hidden"
        aria-label="Primary mobile"
      >
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={href(item.href)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium whitespace-nowrap",
                active ? "bg-white/10 text-white" : "text-ondark-3",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function StatusPill({ degraded, label }: { degraded: boolean; label: string }) {
  return (
    <div
      className={cn(
        "hidden items-center gap-2 rounded-full border py-1.5 pr-3 pl-2.5 text-[11.5px] font-medium sm:flex",
        degraded
          ? "border-accent-500/40 bg-accent-500/10 text-accent-300"
          : "border-brand-400/25 bg-brand-400/10 text-ondark-2",
      )}
      title={
        degraded
          ? "A demo scenario is active — see Settings"
          : "Mock evaluation service responding normally"
      }
    >
      {degraded ? (
        <TriangleAlert className="size-3.5" />
      ) : (
        <RadioTower className="size-3.5 text-ondark-3" />
      )}
      <span className="whitespace-nowrap">{degraded ? label : "Mock data · connected"}</span>
    </div>
  );
}

