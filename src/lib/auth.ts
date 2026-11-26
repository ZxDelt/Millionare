import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Admin auth (GDD §3.1): one shared password from ADMIN_PASSWORD, checked server-side.
 * Cookie is a browser-session cookie (no Max-Age → dropped when the browser closes)
 * holding a signed token with a 30-min idle expiry that is refreshed on activity.
 */
export const ADMIN_COOKIE = "jj_admin";
export const IDLE_MS = 30 * 60 * 1000;

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) throw new Error("APP_SECRET is missing or too short (need 32+ chars). See .env.example.");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string): boolean {
  // Hash first so lengths always match and timing does not leak length.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is not set.");
  return safeEqual(input, expected);
}

export function makeToken(now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ exp: now + IDLE_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number };
    return typeof exp === "number" && exp > now;
  } catch {
    return false;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  // no maxAge/expires on purpose: session cookie, password asked again after browser close
};

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(ADMIN_COOKIE)?.value);
}

/** Call from route handlers / server actions only (cookies can't be set during render). */
export async function refreshAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, makeToken(), cookieOptions);
}
