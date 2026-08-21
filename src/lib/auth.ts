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
 * Per-process fallback signing key.
 *
 * Deliberately random rather than a constant. A literal default committed to the
 * repository is a published HMAC key: anyone reading the source could forge a
 * session cookie for any deployment that had not overridden it. A random key
 * instead means sessions do not survive a restart when AUTH_SECRET is unset,
 * which is a visible nuisance in development and cannot be exploited.
 */
const EPHEMERAL_SECRET = crypto.randomUUID() + crypto.randomUUID();

function getSecret(): string {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 16 && configured !== "change-me-to-a-long-random-string") {
    return configured;
  }
  return EPHEMERAL_SECRET;
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
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
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
