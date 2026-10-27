import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Signs out. For LINE customers the browser also sends the LIFF access token, which we revoke at
 * LINE so "Log in with LINE" asks again instead of silently reusing it.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { lineAccessToken?: unknown } | null;
  const accessToken = typeof body?.lineAccessToken === "string" ? body.lineAccessToken : "";
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID?.trim();
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET?.trim();

  if (accessToken && channelId) {
    const params = new URLSearchParams({ access_token: accessToken, client_id: channelId });
    if (channelSecret) params.set("client_secret", channelSecret);
    try {
      const res = await fetch("https://api.line.me/oauth2/v2.1/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });
      if (!res.ok) console.error("[logout] LINE token revoke failed", res.status);
    } catch (err) {
      console.error("[logout] LINE token revoke failed", err);
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
