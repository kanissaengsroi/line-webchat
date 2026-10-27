import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_COOKIE, callbackUrl, exchangeCode, lineLoginConfig } from "@/lib/lineLogin";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";

function fail(req: NextRequest, error: string) {
  const res = NextResponse.redirect(new URL(`/login?error=${error}`, req.url));
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/line" });
  return res;
}

function sameString(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(req: NextRequest) {
  const cfg = lineLoginConfig();
  if (!cfg) return fail(req, "line_not_configured");

  const params = req.nextUrl.searchParams;
  // The user pressed Cancel on LINE's consent screen.
  if (params.get("error")) return fail(req, "line_cancelled");

  const code = params.get("code");
  const state = params.get("state");
  const [savedState, nonce] = (req.cookies.get(OAUTH_COOKIE)?.value ?? "").split(".");
  if (!code || !state || !savedState || !nonce || !sameString(state, savedState)) {
    return fail(req, "line_failed");
  }

  try {
    const identity = await exchangeCode(code, callbackUrl(req), nonce, cfg);
    const token = await createSessionToken({
      username: identity.name.slice(0, 64),
      role: "customer",
      convId: identity.sub,
      picture: identity.picture,
    });
    const res = NextResponse.redirect(new URL("/chat", req.url));
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/line" });
    return res;
  } catch (err) {
    console.error("[line-login]", err);
    return fail(req, "line_failed");
  }
}
