import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { OAUTH_COOKIE, authorizeUrl, callbackUrl, lineLoginConfig } from "@/lib/lineLogin";

/** Starts LINE Login: remembers state + nonce in a short-lived cookie, then redirects to LINE. */
export async function GET(req: Request) {
  const cfg = lineLoginConfig();
  if (!cfg) return NextResponse.redirect(new URL("/login?error=line_not_configured", req.url));

  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(cfg.channelId, callbackUrl(req), state, nonce));
  res.cookies.set(OAUTH_COOKIE, `${state}.${nonce}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/line",
    maxAge: 600,
  });
  return res;
}
