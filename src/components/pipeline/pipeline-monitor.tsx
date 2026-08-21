"use client";

import { useMemo, useState } from "react";
import { BellOff, BellRing, Radio } from "lucide-react";
import { useSeries } from "@/lib/api/queries";
import { useWorkspace, usePlant } from "@/components/workspace/workspace-context";
import { MODELS, MODEL_FIELD, MODEL_IDS, ACTUAL_COLOR } from "@/lib/config/models";
import { Badge, Card, CardHeader, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/ui/states";
import type { IntervalRecord } from "@/lib/types";
import { blockToClock, eachDay, formatDay, parseTimestampDay } from "@/lib/utils/date";
import { formatInt, formatPct } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** One data feed the workspace depends on. */
interface Feed {
  key: string;
  label: string;
  colour: string;
  /** True when this feed reported a value for the block. */
  present: (row: IntervalRecord) => boolean;
}

const FEEDS: Feed[] = [
  {
    key: "actual",
    label: "Plant telemetry (Actual)",
    colour: ACTUAL_COLOR,
    present: (r) => r.actual_available && r.actual_mw !== null,
  },
  ...MODEL_IDS.map((id) => ({
    key: id,
    label: `${MODELS[id].name} forecast`,
    colour: MODELS[id].color,
    present: (r: IntervalRecord) => r[MODEL_FIELD[id]] !== null,
  })),
];

/** A contiguous run of blocks a feed did not deliver. */
interface Gap {
  day: string;
  fromBlock: number;
  toBlock: number;
  blocks: number;
}

interface FeedHealth {
  feed: Feed;
  received: number;
  expected: number;
  uptimePct: number;
  gaps: Gap[];
  /** Uptime per day, for the strip. */
  perDay: { day: string; pct: number; missing: number }[];
  lastReceived: { day: string; block: number } | null;
}

/* A feed is only "down" if it delivered nothing at all; a feed with holes is
   degraded. The distinction matters because a missing feed and a partial feed
   need different responses, and one threshold cannot express both. */
function statusOf(h: FeedHealth): "live" | "degraded" | "down" {
  if (h.received === 0) return "down";
  return h.uptimePct >= 99.95 ? "live" : "degraded";
}

const STATUS_TEXT = {
  live: { label: "Receiving", tone: "positive" as const },
  degraded: { label: "Gaps", tone: "caution" as const },
  down: { label: "No data", tone: "negative" as const },
};

/**
 * Whether each upstream feed is actually arriving, and where it is not.
 *
 * Computed from the interval payload the rest of the workspace already reads,
 * rather than a separate health endpoint — so the monitor cannot claim a feed is
 * healthy while the charts are drawing holes in it. A feed is present for a
 * block when it reported a value there; the metrics pipeline's eligibility rules
 * are deliberately not applied, because this panel answers "did the data
 * arrive", not "was it usable for scoring".
 *
 * It sits above the scenario switcher on purpose: the data-quality scenarios are
 * exactly the states it exists to surface, so the two read together.
 */
export function PipelineMonitor() {
  const { scope, from, to } = useWorkspace();
  const plant = usePlant();
  const series = useSeries(scope);
  const [notify, setNotify] = useState(false);

  const days = useMemo(() => eachDay(from, to), [from, to]);

  const health = useMemo<FeedHealth[] | null>(() => {
    const intervals = series.data?.intervals;
    if (!intervals) return null;

    /* Hourly means would make a 15-minute gap invisible, so this reports the
       resolution it was given rather than implying block-level precision. */
    const rows = intervals;

    return FEEDS.map((feed) => {
      const gaps: Gap[] = [];
      const perDayMissing = new Map<string, { missing: number; total: number }>();
      let received = 0;
      let last: { day: string; block: number } | null = null;
      let open: Gap | null = null;

      for (const row of rows) {
        const day = parseTimestampDay(row.timestamp);
        const bucket = perDayMissing.get(day) ?? { missing: 0, total: 0 };
        bucket.total += 1;

        if (feed.present(row)) {
          received += 1;
          last = { day, block: row.block };
          if (open) {
            gaps.push(open);
            open = null;
          }
        } else {
          bucket.missing += 1;
          // A run breaks at a day boundary so every gap reads as one date.
          if (open && open.day === day && open.toBlock === row.block - 1) {
            open.toBlock = row.block;
            open.blocks += 1;
          } else {
            if (open) gaps.push(open);
            open = { day, fromBlock: row.block, toBlock: row.block, blocks: 1 };
          }
        }
        perDayMissing.set(day, bucket);
      }
      if (open) gaps.push(open);

      const expected = rows.length;
      return {
        feed,
        received,
        expected,
        uptimePct: expected > 0 ? (received / expected) * 100 : 0,
        gaps: gaps.sort((a, b) => b.blocks - a.blocks),
        perDay: days.map((day) => {
          const b = perDayMissing.get(day);
          return {
            day,
            pct: b && b.total > 0 ? ((b.total - b.missing) / b.total) * 100 : 0,
            missing: b?.missing ?? 0,
          };
        }),
        lastReceived: last,
      };
    });
  }, [series.data, days]);

  const worst = health
    ? health.reduce<"live" | "degraded" | "down">((acc, h) => {
        const s = statusOf(h);
        if (acc === "down" || s === "down") return "down";
        if (acc === "degraded" || s === "degraded") return "degraded";
        return "live";
      }, "live")
    : "live";

  const resolutionNote =
    series.data?.resolution === "hourly"
      ? "Series returned hourly means for this period, so gaps shorter than an hour are not visible here."
      : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Radio className="size-4 text-ink-3" />
            Pipeline monitor
          </span>
        }
        subtitle={`Delivery of every upstream feed for ${plant.name} across the selected period — ${formatInt(days.length)} ${days.length === 1 ? "day" : "days"}`}
        actions={
          health ? (
            <Badge tone={STATUS_TEXT[worst].tone}>
              {worst === "live"
                ? "All feeds receiving"
                : worst === "degraded"
                  ? "Gaps detected"
                  : "Feed down"}
            </Badge>
          ) : null
        }
      />

      {series.isError ? (
        <div className="p-5">
          <ErrorState error={series.error} onRetry={() => series.refetch()} compact />
        </div>
      ) : !health ? (
        <div className="space-y-2 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-line-soft border-y border-line-soft">
          {health.map((h) => (
            <FeedRow key={h.feed.key} health={h} multiDay={days.length > 1} />
          ))}
        </div>
      )}

      {/* Notification opt-in — the control only. Nothing is wired to a
          transport yet, and the copy says so rather than implying alerts are
          being delivered. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-surface-muted px-5 py-3.5">
        <button
          role="switch"
          aria-checked={notify}
          onClick={() => setNotify((v) => !v)}
          className={cn(
            "inline-flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
            notify
              ? "border-line-hud bg-tint text-hud"
              : "border-line-strong bg-surface text-ink-3 hover:bg-surface-sunken",
          )}
        >
          {notify ? <BellRing className="size-4" /> : <BellOff className="size-4" />}
          <span className="text-[12.5px] font-medium">
            {notify ? "Notifications enabled" : "Enable notifications"}
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "relative ml-1 h-4 w-7 rounded-full transition-colors",
              notify ? "bg-hud" : "bg-line-strong",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-3 rounded-full bg-white transition-all",
                notify ? "left-[14px]" : "left-0.5",
              )}
            />
          </span>
        </button>

        <p className="min-w-[24ch] flex-1 text-[11.5px] leading-relaxed text-ink-3">
          {notify
            ? "This toggle is a placeholder. No delivery channel is connected yet, so nothing is sent — wiring email or webhook alerts is a backend task."
            : "Would alert on a feed going quiet or a gap opening. The delivery channel is not built yet; this control only records the intent."}
          {resolutionNote ? ` ${resolutionNote}` : ""}
        </p>
      </div>
    </Card>
  );
}

function FeedRow({ health, multiDay }: { health: FeedHealth; multiDay: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const status = statusOf(health);
  const missing = health.expected - health.received;
  const shown = expanded ? health.gaps : health.gaps.slice(0, 3);

  return (
    <div className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <StatusDot status={status} colour={health.feed.colour} />
          <span className="truncate text-[13px] font-semibold text-ink">{health.feed.label}</span>
        </span>

        <span className="ml-auto flex items-center gap-4">
          <span className="text-right">
            <span className="readout block text-[15px] leading-none text-ink">
              {formatPct(health.uptimePct)}
            </span>
            <span className="mt-1 block text-[10px] tracking-[0.08em] text-ink-4 uppercase">
              delivered
            </span>
          </span>
          <span className="text-right">
            <span className="tnum block text-[12.5px] leading-none text-ink-2">
              {formatInt(health.received)}
              <span className="text-ink-4">/</span>
              {formatInt(health.expected)}
            </span>
            <span className="mt-1 block text-[10px] tracking-[0.08em] text-ink-4 uppercase">
              blocks
            </span>
          </span>
          <Badge tone={STATUS_TEXT[status].tone}>{STATUS_TEXT[status].label}</Badge>
        </span>
      </div>

      {/* Per-day delivery. One cell per day, so a bad day is locatable at a
          glance before reading any timestamps. */}
      {multiDay ? (
        <div className="mt-3 flex items-end gap-[3px]">
          {health.perDay.map((d) => (
            <span
              key={d.day}
              title={`${formatDay(d.day)} — ${formatPct(d.pct)} delivered${d.missing ? `, ${d.missing} blocks missing` : ""}`}
              className="h-4 min-w-[4px] flex-1 rounded-[2px]"
              style={{
                backgroundColor:
                  d.pct >= 99.95
                    ? `${health.feed.colour}d9`
                    : d.pct > 0
                      ? `${health.feed.colour}59`
                      : "var(--color-line-strong)",
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
        {missing === 0 ? (
          <span>
            No gaps. Last block received{" "}
            {health.lastReceived
              ? `${formatDay(health.lastReceived.day, { year: false })} ${blockToClock(health.lastReceived.block)}`
              : "—"}
            .
          </span>
        ) : (
          <>
            <span className="font-medium text-ink-2">
              {formatInt(missing)} {missing === 1 ? "block" : "blocks"} missing in{" "}
              {formatInt(health.gaps.length)} {health.gaps.length === 1 ? "gap" : "gaps"}:
            </span>
            {shown.map((g) => (
              <span
                key={`${g.day}-${g.fromBlock}`}
                className="tnum rounded-md bg-surface-sunken px-2 py-[3px] text-ink-2 ring-1 ring-line ring-inset"
              >
                {formatDay(g.day, { year: false })} {blockToClock(g.fromBlock)}
                {g.blocks > 1 ? `–${blockToClock(g.toBlock + 1)}` : ""}
                <span className="ml-1.5 text-ink-4">
                  {g.blocks} {g.blocks === 1 ? "blk" : "blks"}
                </span>
              </span>
            ))}
            {health.gaps.length > 3 ? (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="font-medium text-hud underline decoration-line-hud underline-offset-2"
              >
                {expanded ? "show fewer" : `+${health.gaps.length - 3} more`}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function StatusDot({
  status,
  colour,
}: {
  status: "live" | "degraded" | "down";
  colour: string;
}) {
  return (
    <span aria-hidden="true" className="relative grid size-3 shrink-0 place-items-center">
      <span
        className="size-2.5 rounded-full"
        style={{
          backgroundColor: status === "down" ? "var(--color-line-strong)" : colour,
          opacity: status === "degraded" ? 0.55 : 1,
        }}
      />
      {status === "live" ? (
        <span
          className="absolute inset-0 animate-ping rounded-full motion-reduce:animate-none"
          style={{ backgroundColor: colour, opacity: 0.28 }}
        />
      ) : null}
    </span>
  );
}
