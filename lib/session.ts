import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "lw_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export interface Session {
  username: string;
}

export const USERNAME_PATTERN = /^[\p{L}\p{M}\p{N}._-]{2,32}$/u;

// Read directly here (not via lib/env) because middleware runs on the edge runtime.
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing environment variable SESSION_SECRET.");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ username: session.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.username === "string" ? { username: payload.username } : null;
  } catch {
    return null;
  }
}
