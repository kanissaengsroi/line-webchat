import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "lw_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/** agent = staff answering in the inbox; customer = someone chatting with the OA from the website. */
export type Role = "agent" | "customer";

export interface Session {
  username: string;
  role: Role;
  /** Customers only: the conversation they chat in (LINE user ID, or a web guest ID). */
  convId?: string;
  picture?: string;
}

export const USERNAME_PATTERN = /^[\p{L}\p{M}\p{N}._-]{2,32}$/u;

// Read directly here (not via lib/env) because middleware runs on the edge runtime.
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing environment variable SESSION_SECRET.");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.username !== "string") return null;
    const convId = typeof payload.convId === "string" ? payload.convId : undefined;
    // A customer session without a conversation is unusable; treat it as signed out.
    if (payload.role === "customer" && !convId) return null;
    return {
      username: payload.username,
      role: payload.role === "customer" ? "customer" : "agent",
      convId,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
