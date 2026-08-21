import { NextResponse } from "next/server";
import { getSeries, resolveScope } from "@/lib/mock/service";
import { handleServiceError, readScopeParams } from "@/lib/api/route-helpers";

/** GET /api/evaluation/series — interval series backing the primary chart. */
export function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(getSeries(resolveScope(readScopeParams(url))));
  } catch (err) {
    return handleServiceError(err);
  }
}
