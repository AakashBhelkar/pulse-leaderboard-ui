"use client";

import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  live,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { live?: boolean }) {
  return (
    <div className={cn("card", live && "card-live", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  info,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  info?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 text-[15px] leading-tight font-semibold tracking-[-0.01em] text-ink">
          {title}
          {info}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-[12.5px] leading-snug text-ink-3">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-800 text-white hover:bg-brand-700 active:bg-brand-900 shadow-[0_1px_2px_rgba(16,34,27,0.16)]",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-surface-sunken hover:border-ink-4/40",
  ghost: "text-ink-2 hover:bg-canvas-deep hover:text-ink",
  accent:
    "bg-accent-400 text-brand-900 hover:bg-accent-300 active:bg-accent-500 shadow-[0_1px_2px_rgba(154,100,16,0.2)]",
  danger: "bg-negative text-white hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12.5px] gap-1.5 rounded-lg",
  md: "h-9.5 px-4 text-[13px] gap-2 rounded-[10px]",
  lg: "h-11 px-5 text-[14px] gap-2 rounded-[11px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150",
        "disabled:pointer-events-none disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge / chips                                                               */
/* -------------------------------------------------------------------------- */

type BadgeTone = "neutral" | "positive" | "caution" | "negative" | "brand" | "info";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-ink-2 border-line",
  positive: "bg-brand-50 text-brand-700 border-brand-200",
  caution: "bg-accent-50 text-accent-700 border-accent-200",
  negative: "bg-[#fdeceb] text-[#a8302c] border-[#f6c9c7]",
  brand: "bg-brand-800 text-brand-100 border-brand-800",
  info: "bg-[#eef4f9] text-[#265877] border-[#cfe0ec]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[11px] leading-none font-semibold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The in-cell winner marker used across leaderboard, matrix and daily views. */
export function WinnerMark({ label = "Best" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-[2px] text-[10px] leading-none font-bold tracking-wide text-brand-700 uppercase ring-1 ring-brand-200 ring-inset"
      title="Winner for this metric"
    >
      <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
        <path
          d="M1 5.4 3.6 8 9 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Tolerance status glyph                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Per-value status indicator. It sits directly beside a model's reading, so the
 * within/outside call needs no cross-reference to a separate status column.
 */
export function ToleranceGlyph({
  outside,
  tolerancePct,
  modelName,
}: {
  outside: boolean;
  tolerancePct: number;
  modelName: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid size-[16px] shrink-0 place-items-center rounded-md text-[10px] leading-none font-bold",
        outside
          ? "bg-accent-50 text-accent-700 ring-1 ring-accent-200 ring-inset"
          : "text-brand-400",
      )}
      title={
        outside
          ? `${modelName} is outside Band A — more than ${tolerancePct}% from this block's Actual`
          : `${modelName} is in Band A — within ${tolerancePct}% of this block's Actual`
      }
      aria-label={outside ? "outside Band A" : "in Band A"}
    >
      {outside ? "!" : "✓"}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Model identity                                                              */
/* -------------------------------------------------------------------------- */

export function ModelDot({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: `0 0 0 2.5px ${color}1f`,
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Skeletons                                                                   */
/* -------------------------------------------------------------------------- */

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={cn("skeleton", className)} style={style} />;
}

/* -------------------------------------------------------------------------- */
/* Directional arrow used beside every metric label                            */
/* -------------------------------------------------------------------------- */

export function DirectionArrow({
  direction,
  className,
}: {
  direction: "lower" | "higher" | "zero";
  className?: string;
}) {
  const glyph = direction === "higher" ? "↑" : direction === "lower" ? "↓" : "→0";
  return (
    <span
      className={cn("text-[10px] leading-none font-semibold text-ink-4", className)}
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
}
