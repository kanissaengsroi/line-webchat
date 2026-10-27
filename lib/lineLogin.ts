// LINE Login (OAuth 2.1 + OpenID Connect) for customers chatting with the OA from the web.
// Uses a separate "LINE Login" channel. It must sit under the same LINE provider as the
// Messaging API channel, so the user ID matches the one in webhook events.

export const OAUTH_COOKIE = "lw_line_oauth";

export function lineLoginConfig() {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID?.trim();
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET?.trim();
  return channelId && channelSecret ? { channelId, channelSecret } : null;
}

export function callbackUrl(req: Request) {
  return `${new URL(req.url).origin}/api/auth/line/callback`;
}

export function authorizeUrl(channelId: string, redirectUri: string, state: string, nonce: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: redirectUri,
    state,
    nonce,
    scope: "profile openid",
    // Offers to add the linked OA as a friend, so agent replies also reach the LINE app.
    bot_prompt: "aggressive",
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${params}`;
}

interface LineIdentity {
  sub: string;
  name: string;
  picture?: string;
}

/** Exchanges the code for tokens and verifies the ID token with LINE. */
export async function exchangeCode(
  code: string,
  redirectUri: string,
  nonce: string,
  cfg: { channelId: string; channelSecret: string },
): Promise<LineIdentity> {
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: cfg.channelId,
      client_secret: cfg.channelSecret,
    }),
  });
  if (!tokenRes.ok) throw new Error(`token exchange failed (${tokenRes.status})`);
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) throw new Error("no id_token (is the openid scope enabled?)");

  // LINE checks signature, audience, expiry and nonce for us.
  const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token, client_id: cfg.channelId, nonce }),
  });
  if (!verifyRes.ok) throw new Error(`id_token verification failed (${verifyRes.status})`);
  const claims = (await verifyRes.json()) as { sub?: string; name?: string; picture?: string };
  if (!claims.sub) throw new Error("id_token has no subject");
  return { sub: claims.sub, name: claims.name || "LINE user", picture: claims.picture };
}
