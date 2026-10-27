import Pusher from "pusher";
import { env } from "./env";
import type { MessageEvent } from "./types";

export const INBOX_CHANNEL = "private-inbox";
export const MESSAGE_EVENT = "message:new";
export const READ_EVENT = "conv:read";

// Pusher rejects payloads over 10 KB; Thai text is 3 bytes per character.
const MAX_PUSH_TEXT = 1500;

let client: Pusher | null | undefined;

export function getPusher(): Pusher | null {
  if (client !== undefined) return client;
  const cfg = env.pusher;
  client = cfg ? new Pusher({ ...cfg, useTLS: true }) : null;
  return client;
}

export async function publishMessage(event: MessageEvent): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  const { message, conversation } = event;
  const truncated = message.text.length > MAX_PUSH_TEXT;
  const payload: MessageEvent = {
    message: truncated ? { ...message, text: message.text.slice(0, MAX_PUSH_TEXT) } : message,
    conversation: { ...conversation, lastText: conversation.lastText.slice(0, 200) },
    truncated,
  };
  try {
    await pusher.trigger(INBOX_CHANNEL, MESSAGE_EVENT, payload);
  } catch (err) {
    // Realtime is best effort; clients resync on reconnect.
    console.error("[pusher] trigger failed", err);
  }
}

export async function publishRead(userId: string): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  try {
    await pusher.trigger(INBOX_CHANNEL, READ_EVENT, { userId });
  } catch (err) {
    console.error("[pusher] trigger failed", err);
  }
}
