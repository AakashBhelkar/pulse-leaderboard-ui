/** Date helpers that operate on plain `YYYY-MM-DD` strings.
 *  Everything is IST by contract, so we never let the runtime's local timezone
 *  shift a plant day boundary. */

export const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDay(s: string | null | undefined): s is string {
  return !!s && ISO_DAY.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function dayToUtc(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

export function utcToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return utcToDay(dayToUtc(day) + n * 86400000);
}

export function diffDays(from: string, to: string): number {
  return Math.round((dayToUtc(to) - dayToUtc(from)) / 86400000);
}

/** Inclusive list of days between `from` and `to`. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const n = diffDays(from, to);
  if (n < 0) return out;
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

export function clampDay(day: string, min: string, max: string): string {
  if (dayToUtc(day) < dayToUtc(min)) return min;
  if (dayToUtc(day) > dayToUtc(max)) return max;
  return day;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** `18 Aug 2026` */
export function formatDay(day: string, opts?: { year?: boolean }): string {
  const d = new Date(dayToUtc(day));
  const base = `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
  return opts?.year === false ? base : `${base} ${d.getUTCFullYear()}`;
}

/** `Tue 18 Aug` */
export function formatDayWithWeekday(day: string): string {
  const d = new Date(dayToUtc(day));
  return `${WEEKDAYS[d.getUTCDay()]} ${formatDay(day, { year: false })}`;
}

export function formatRange(from: string, to: string): string {
  if (from === to) return formatDay(from);
  const a = new Date(dayToUtc(from));
  const b = new Date(dayToUtc(to));
  if (a.getUTCFullYear() === b.getUTCFullYear()) {
    if (a.getUTCMonth() === b.getUTCMonth()) {
      return `${String(a.getUTCDate()).padStart(2, "0")}–${formatDay(to)}`;
    }
    return `${formatDay(from, { year: false })} – ${formatDay(to)}`;
  }
  return `${formatDay(from)} – ${formatDay(to)}`;
}

/** Block index (0–95) to `HH:MM` clock time. */
export function blockToTime(block: number): string {
  const mins = block * 15;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** `10:15 AM` */
export function blockToClock(block: number): string {
  const mins = block * 15;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** ISO timestamp with the fixed IST offset used across the contract. */
export function blockTimestamp(day: string, block: number): string {
  return `${day}T${blockToTime(block)}:00+05:30`;
}

export function parseTimestampDay(ts: string): string {
  return ts.slice(0, 10);
}

export function parseTimestampBlock(ts: string): number {
  const h = Number(ts.slice(11, 13));
  const m = Number(ts.slice(14, 16));
  return h * 4 + Math.floor(m / 15);
}

export const BLOCKS_PER_DAY = 96;

/**
 * Longest selectable period, in days.
 *
 * Everything downstream is sized by this: the series stays at full 15-minute
 * resolution (30 × 96 = 2,880 blocks) rather than being averaged, and the block
 * table can cover any selectable period. Raising it means revisiting both.
 */
export const MAX_RANGE_DAYS = 30;

/**
 * Clamp a period to the data window and to `MAX_RANGE_DAYS`.
 *
 * Every entry point — the picker, a URL someone pasted, a compare row — routes
 * through here, so an over-long range cannot reach the service by any path.
 * The anchor decides which end gives way: moving `from` pulls `to` in, and
 * vice versa, which is what makes the picker feel like it is obeying you.
 */
export function clampRange(
  from: string,
  to: string,
  bounds: { min: string; max: string },
  anchor: "from" | "to" = "to",
): { from: string; to: string; capped: boolean } {
  let start = clampDay(from, bounds.min, bounds.max);
  let end = clampDay(to, bounds.min, bounds.max);
  if (dayToUtc(end) < dayToUtc(start)) [start, end] = [end, start];

  const span = diffDays(start, end) + 1;
  if (span <= MAX_RANGE_DAYS) return { from: start, to: end, capped: false };

  if (anchor === "from") {
    end = clampDay(addDays(start, MAX_RANGE_DAYS - 1), bounds.min, bounds.max);
  } else {
    start = clampDay(addDays(end, -(MAX_RANGE_DAYS - 1)), bounds.min, bounds.max);
  }
  return { from: start, to: end, capped: true };
}

/* --- Calendar-widget interop ------------------------------------------- */
/* react-day-picker works in the browser's local timezone. Converting through
   UTC midnight would shift the day either side of the date line, so these two
   helpers move between our `YYYY-MM-DD` strings and *local* Date objects. */

export function dayToLocalDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function localDateToDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
