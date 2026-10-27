import crypto from "node:crypto";
import { env } from "./env";
import type { Profile } from "./store";

const API = "https://api.line.me/v2/bot";

/** Checks the x-line-signature header against the raw request body. */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", env.lineChannelSecret)
    .update(rawBody, "utf8")
    .digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

export class LineApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const token = env.lineAccessToken;
  if (!token) return null;
  const res = await fetch(`${API}/profile/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { displayName: string; pictureUrl?: string };
  return { displayName: data.displayName, pictureUrl: data.pictureUrl };
}

export interface BotInfo {
  displayName: string;
  pictureUrl?: string;
  basicId?: string;
}

/** The OA's own name and picture, for the customer chat header. Cached for an hour. */
export async function getBotInfo(): Promise<BotInfo | null> {
  const token = env.lineAccessToken;
  if (!token) return null;
  try {
    const res = await fetch(`${API}/info`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as BotInfo;
  } catch {
    return null;
  }
}

/** LINE wants a UUID retry key; derive a stable one from our message id so retries dedupe. */
export function retryKeyFor(id: string): string {
  const hex = crypto.createHash("sha256").update(id).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Sends a text message from the OA to one LINE user. */
export async function pushText(to: string, text: string, retryKey: string): Promise<void> {
  const token = env.lineAccessToken;
  if (!token) {
    console.info(`[line] (dev, no access token) push to ${to}: ${text}`);
    return;
  }
  const res = await fetch(`${API}/message/push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // Lets LINE drop duplicates if the same send is retried.
      "X-Line-Retry-Key": retryKey,
    },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
  // 409 = this retry key was already accepted, so the message was delivered.
  if (res.ok || res.status === 409) return;
  let detail = res.statusText;
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) detail = body.message;
  } catch {}
  throw new LineApiError(detail, res.status);
}
