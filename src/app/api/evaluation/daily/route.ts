import { NextResponse } from "next/server";
import { getDaily, resolveScope } from "@/lib/mock/service";
import { handleServiceError, readScopeParams } from "@/lib/api/route-helpers";

/** GET /api/evaluation/daily — per-day evidence for the selected range. */
export function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(getDaily(resolveScope(readScopeParams(url))));
  } catch (err) {
    return handleServiceError(err);
  }
}
