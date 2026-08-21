import { NextResponse } from "next/server";
import { getDayDetail, resolveScope } from "@/lib/mock/service";
import { handleServiceError, readScopeParams } from "@/lib/api/route-helpers";
import { isValidDay } from "@/lib/utils/date";
import { jsonError } from "@/lib/api/route-helpers";

/** GET /api/evaluation/day — the 96 blocks of one plant-day. */
export function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    if (!isValidDay(date)) {
      return jsonError("bad_request", "A valid `date` (YYYY-MM-DD) is required.", 400, false);
    }
    const scope = resolveScope({ ...readScopeParams(url), from: date, to: date });
    return NextResponse.json(getDayDetail(scope, date));
  } catch (err) {
    return handleServiceError(err);
  }
}
