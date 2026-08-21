/**
 * Shared-password access (PRD §6.1).
 *
 * The password is validated server-side only and is never shipped to the
 * client. The session cookie is an HMAC-signed, expiring token — it carries no
 * secret material, so it can be verified in middleware without a datastore.
 */

export const SESSION_COOKIE = "sfl_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

/**
 * The signing key, or null when none is usable.
 *
 * Null rather than a fallback of any kind. A committed constant is a published
 * HMAC key — anyone reading the source could forge a session for a deployment
 * that had not overridden it. A random per-process key is no better here: the
 * proxy that verifies the cookie runs in a different runtime instance from the
 * route that signs it, so each generates its own value and every session is
 * rejected — login appearing to succeed, then bouncing straight back to the
 * sign-in page with nothing to explain why.
 *
 * So there is no fallback. Unconfigured means sessions cannot be issued, and
 * the login route says exactly that.
 */
function getSecret(): string | null {
  const configured = process.env.AUTH_SECRET;
  if (!configured || configured.length < 16) return null;
  if (configured === "change-me-to-a-long-random-string") return null;
  return configured;
}

/** Whether the server can issue and verify sessions at all. */
export function isSessionSigningConfigured(): boolean {
  return getSecret() !== null;
}

/**
 * The shared access code, or null when none is configured.
 *
 * Null makes the login route refuse every attempt. The previous fallback was a
 * real code written into the source, so the gate stood open on any deployment
 * that forgot the environment variable — and shipped that code to anyone who
 * could read the repository.
 */
export function getSharedPassword(): string | null {
  const configured = process.env.LEADERBOARD_PASSWORD;
  return configured && configured.length > 0 ? configured : null;
}

const enc = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const secret = getSecret();
  if (secret === null) throw new Error("AUTH_SECRET is not configured.");
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `v1.${expires}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, expiresRaw, signature] = parts;
  if (version !== "v1") return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await sign(`${version}.${expiresRaw}`);
  // Constant-time-ish comparison; lengths are fixed for a given hash.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
