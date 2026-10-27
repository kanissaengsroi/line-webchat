// Every secret is read from process.env only. Locally they live in .env.local,
// in production in Vercel → Project → Settings → Environment Variables.

function pick(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function required(...names: string[]): string {
  const value = pick(...names);
  if (!value) {
    throw new Error(
      `Missing environment variable ${names.join(" or ")}. ` +
        "Add it to .env.local (local) or the Vercel project settings (production).",
    );
  }
  return value;
}

export const isProd = process.env.NODE_ENV === "production";

export const env = {
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get lineChannelSecret() {
    return required("LINE_CHANNEL_SECRET");
  },
  /** Optional in development: without it, pushes are logged instead of sent. */
  get lineAccessToken() {
    return isProd ? required("LINE_CHANNEL_ACCESS_TOKEN") : pick("LINE_CHANNEL_ACCESS_TOKEN");
  },
  /** Optional in development: without it, an in-memory store is used. */
  get redis() {
    const url = pick("UPSTASH_REDIS_REST_URL", "KV_REST_API_URL");
    const token = pick("UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN");
    if (url && token) return { url, token };
    if (isProd) required("UPSTASH_REDIS_REST_URL", "KV_REST_API_URL");
    return undefined;
  },
  /** Optional: without it, the client falls back to polling. */
  get pusher() {
    const appId = pick("PUSHER_APP_ID");
    const key = pick("PUSHER_KEY", "NEXT_PUBLIC_PUSHER_KEY");
    const secret = pick("PUSHER_SECRET");
    const cluster = pick("PUSHER_CLUSTER", "NEXT_PUBLIC_PUSHER_CLUSTER");
    if (appId && key && secret && cluster) return { appId, key, secret, cluster };
    return undefined;
  },
};
