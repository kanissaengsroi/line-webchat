// LINE Login for customers, done through LIFF (/liff). The LIFF app belongs to a "LINE Login"
// channel, which must sit under the same LINE provider as the Messaging API channel so the
// user ID matches the one in webhook events.

/** LINE login is available when both the LINE Login channel and its LIFF app are configured. */
export function lineLoginConfig() {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID?.trim();
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  return channelId && liffId ? { channelId, liffId } : null;
}

interface LineIdentity {
  sub: string;
  name: string;
  picture?: string;
}

/** Verifies a LINE ID token with LINE (signature, audience = the LINE Login channel, expiry). */
export async function verifyIdToken(idToken: string, channelId: string): Promise<LineIdentity> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });
  if (!res.ok) throw new Error(`id_token verification failed (${res.status})`);
  const claims = (await res.json()) as { sub?: string; name?: string; picture?: string };
  if (!claims.sub) throw new Error("id_token has no subject");
  return { sub: claims.sub, name: claims.name || "LINE user", picture: claims.picture };
}
