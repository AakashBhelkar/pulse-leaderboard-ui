import { NextResponse } from "next/server";
import { getSummary, resolveScope } from "@/lib/mock/service";
import { handleServiceError, readScopeParams } from "@/lib/api/route-helpers";

/** GET /api/evaluation/summary — range metrics, coverage and metric winners. */
export function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(getSummary(resolveScope(readScopeParams(url))));
  } catch (err) {
    return handleServiceError(err);
  }
}
