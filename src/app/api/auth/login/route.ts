import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  getSharedPassword,
} from "@/lib/auth";

/** POST /api/auth/login — validates the shared password server-side. */
export async function POST(request: Request) {
  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = body.password ?? "";
  } catch {
    // fall through to the generic failure below
  }

  // Small fixed delay blunts trivial online guessing of a shared secret.
  await new Promise((r) => setTimeout(r, 350));

  /* No code configured means the gate is shut, not open. Checked before the
     comparison so a null can never be matched by an equal null from the body. */
  const expected = getSharedPassword();
  if (expected === null) {
    return NextResponse.json(
      {
        error: "not_configured",
        message: "No access code is configured on the server. Set LEADERBOARD_PASSWORD.",
      },
      { status: 503 },
    );
  }

  if (password !== expected) {
    return NextResponse.json(
      { error: "invalid_password", message: "That access code is not recognised." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
