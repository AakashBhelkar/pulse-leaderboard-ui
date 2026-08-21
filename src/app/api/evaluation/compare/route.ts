import { NextResponse } from "next/server";
import { getComparison } from "@/lib/mock/service";
import { handleServiceError, jsonError } from "@/lib/api/route-helpers";
import type { CompareSelection } from "@/lib/types";

/** POST /api/evaluation/compare — metrics for multiple plant/date selections. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      selections?: CompareSelection[];
      scenario?: string | null;
    };
    const selections = body.selections ?? [];
    if (!Array.isArray(selections) || selections.length === 0) {
      return jsonError("bad_request", "At least one selection is required.", 400, false);
    }
    if (selections.length > 6) {
      return jsonError("bad_request", "A comparison supports at most six selections.", 400, false);
    }
    return NextResponse.json(getComparison(selections, body.scenario ?? null));
  } catch (err) {
    return handleServiceError(err);
  }
}
