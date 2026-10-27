import Pusher from "pusher";
import { env } from "./env";
import type { Conversation, MessageEvent } from "./types";

export const INBOX_CHANNEL = "private-inbox";
export const MESSAGE_EVENT = "message:new";
export const READ_EVENT = "conv:read";

/** Private channel a customer on the website listens to for their own thread. */
export const customerChannel = (lineUserId: string) => `private-user-${lineUserId}`;

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
    // Agents see everything; the customer sees only their own thread.
    await pusher.trigger([INBOX_CHANNEL, customerChannel(conversation.userId)], MESSAGE_EVENT, payload);
  } catch (err) {
    // Realtime is best effort; clients resync on reconnect.
    console.error("[pusher] trigger failed", err);
  }
}

export const UPDATE_EVENT = "conv:update";
export const DELETE_EVENT = "conv:delete";

/** Pin / mute changed: other staff tabs re-sort their inbox. */
export async function publishConversation(conversation: Conversation): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  try {
    await pusher.trigger(INBOX_CHANNEL, UPDATE_EVENT, {
      conversation: { ...conversation, lastText: conversation.lastText.slice(0, 200) },
    });
  } catch (err) {
    console.error("[pusher] trigger failed", err);
  }
}

/** Conversation deleted: staff drop it; the customer's open chat clears. */
export async function publishDelete(userId: string): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  try {
    await pusher.trigger([INBOX_CHANNEL, customerChannel(userId)], DELETE_EVENT, { userId });
  } catch (err) {
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
