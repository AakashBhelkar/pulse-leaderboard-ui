import { NextResponse } from "next/server";
import { PLANT_LIST } from "@/lib/config/plants";

export const dynamic = "force-static";

/** GET /api/plants — plant configuration and state metadata (PRD §18). */
export function GET() {
  return NextResponse.json({ plants: PLANT_LIST });
}
