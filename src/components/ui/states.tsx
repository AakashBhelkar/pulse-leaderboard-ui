"use client";

import type { ReactNode } from "react";
import { CalendarX2, DatabaseZap, RefreshCw, TriangleAlert } from "lucide-react";
import { ApiError } from "@/lib/types";
import { Button, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils/cn";

/* -------------------------------------------------------------------------- */
/* Error + empty states (PRD §20)                                              */
/* -------------------------------------------------------------------------- */

export function ErrorState({
  error,
  onRetry,
  compact,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const isEmpty = apiError?.status === 404;

  if (isEmpty) {
    return (
      <EmptyState
        title="No evaluation data for this selection"
        body="The evaluation service returned no records for this plant and period. Try a different date range, or switch plants."
        icon={<CalendarX2 className="size-5" />}
        compact={compact}
      />
    );
  }

  const message =
    apiError?.message ?? "Something went wrong while loading this view.";

  return (
    <Card
      className={cn(
        "flex flex-col items-center border-line-danger bg-danger-tint text-center",
        compact ? "px-5 py-7" : "px-6 py-12",
      )}
    >
      <span className="grid size-11 place-items-center rounded-xl bg-danger-tint text-danger">
        <TriangleAlert className="size-5" />
      </span>
      <h3 className="mt-3.5 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        Could not load evaluation data
      </h3>
      <p className="mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-ink-2">{message}</p>
      <p className="mt-2 max-w-[52ch] text-[11.5px] leading-relaxed text-ink-4">
        Nothing is being shown from cache — no figures on this screen are stale
        substitutes for the request that failed.
      </p>
      {onRetry ? (
        <Button variant="primary" size="md" className="mt-5" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      ) : null}
    </Card>
  );
}

export function EmptyState({
  title,
  body,
  icon,
  action,
  compact,
}: {
  title: string;
  body: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "px-5 py-7" : "px-6 py-14",
      )}
    >
      <span className="grid size-11 place-items-center rounded-xl bg-surface-sunken text-ink-3">
        {icon ?? <DatabaseZap className="size-5" />}
      </span>
      <h3 className="mt-3.5 text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      <p className="mt-1.5 max-w-[48ch] text-[13px] leading-relaxed text-ink-2">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}

/** Banner shown when the payload is explicitly flagged stale by the backend. */
export function StaleBanner({ generatedAt }: { generatedAt: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-line-warn bg-warn-tint px-4 py-3 text-[12.5px] text-warn">
      <TriangleAlert className="size-4 shrink-0" />
      <p className="leading-relaxed">
        <span className="font-semibold">Showing the last successful result. </span>
        The most recent refresh did not complete, so these figures are not current. Last
        good payload: {generatedAt.slice(0, 16).replace("T", " ")} IST.
      </p>
    </div>
  );
}
