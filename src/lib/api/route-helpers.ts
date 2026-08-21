import { NextResponse } from "next/server";
import { MockEmptyError, MockFailureError } from "@/lib/mock/service";
import type { ApiErrorBody } from "@/lib/types";

export function jsonError(
  error: string,
  message: string,
  status: number,
  retryable = true,
) {
  const body: ApiErrorBody = { error, message, retryable };
  return NextResponse.json(body, { status });
}

/** Maps the mock service's failure modes onto the HTTP contract. */
export function handleServiceError(err: unknown) {
  if (err instanceof MockEmptyError) {
    return jsonError("no_data", err.message, 404, false);
  }
  if (err instanceof MockFailureError) {
    return jsonError(
      "upstream_unavailable",
      "The evaluation service is not responding. No cached result is available for this selection.",
      503,
      true,
    );
  }
  const message = err instanceof Error ? err.message : "Unexpected server error.";
  return jsonError("internal_error", message, 500, true);
}

export function readScopeParams(url: URL) {
  return {
    plantId: url.searchParams.get("plant_id"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    scenario: url.searchParams.get("scenario"),
  };
}
