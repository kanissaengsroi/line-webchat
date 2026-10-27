import { NextResponse } from "next/server";
import { lineLoginConfig, verifyIdToken } from "@/lib/lineLogin";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from "@/lib/session";

/** Signs a customer in from inside LINE (LIFF): the ID token comes from liff.getIDToken(). */
export async function POST(req: Request) {
  const cfg = lineLoginConfig();
  if (!cfg) return NextResponse.json({ error: "line_not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { idToken?: unknown } | null;
  if (typeof body?.idToken !== "string" || !body.idToken) {
    return NextResponse.json({ error: "missing_id_token" }, { status: 400 });
  }

  try {
    // The LIFF app belongs to the LINE Login channel, so the token's audience is that channel.
    const identity = await verifyIdToken(body.idToken, cfg.channelId);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(
      SESSION_COOKIE,
      await createSessionToken({
        username: identity.name.slice(0, 64),
        role: "customer",
        convId: identity.sub,
        picture: identity.picture,
      }),
      sessionCookieOptions,
    );
    return res;
  } catch (err) {
    console.error("[liff-login]", err);
    return NextResponse.json({ error: "invalid_id_token" }, { status: 401 });
  }
}
