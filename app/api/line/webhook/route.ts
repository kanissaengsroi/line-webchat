import { NextResponse } from "next/server";
import { getProfile, verifySignature } from "@/lib/line";
import { publishMessage } from "@/lib/pusher";
import { getStore } from "@/lib/store";
import type { ChatMessage, MessageType } from "@/lib/types";

export const runtime = "nodejs";

interface LineEvent {
  type: string;
  timestamp: number;
  source?: { type: string; userId?: string };
  webhookEventId?: string;
  message?: {
    id: string;
    type: string;
    text?: string;
    fileName?: string;
    title?: string;
    address?: string;
  };
}

const KNOWN_TYPES: MessageType[] = ["text", "sticker", "image", "video", "audio", "file", "location"];

function toChatMessage(event: LineEvent): ChatMessage | null {
  const id = event.message?.id ?? event.webhookEventId ?? `${event.type}-${event.timestamp}`;
  if (event.type === "follow" || event.type === "unfollow") {
    return { id, dir: "in", type: event.type, text: "", at: event.timestamp };
  }
  if (event.type !== "message" || !event.message) return null;
  const m = event.message;
  const type = (KNOWN_TYPES as string[]).includes(m.type) ? (m.type as MessageType) : "unknown";
  const text =
    type === "text"
      ? (m.text ?? "")
      : type === "file"
        ? (m.fileName ?? "")
        : type === "location"
          ? [m.title, m.address].filter(Boolean).join(" · ")
          : "";
  return { id, dir: "in", type, text, at: event.timestamp };
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const store = getStore();
  for (const event of events) {
    // Only one-to-one chats; group and room messages are out of scope.
    const userId = event.source?.type === "user" ? event.source.userId : undefined;
    if (!userId) continue;
    const message = toChatMessage(event);
    if (!message) continue;

    try {
      // Refresh the LINE profile on follow, and whenever we have not seen this user yet.
      const existing = await store.getConversation(userId);
      if (event.type === "follow" || !existing || !existing.pictureUrl) {
        const profile = await getProfile(userId);
        if (profile) await store.upsertProfile(userId, profile);
      }
      const conversation = await store.appendMessage(userId, message);
      await publishMessage({ conversation, message });
    } catch (err) {
      console.error("[webhook] failed to handle event", event.type, err);
    }
  }

  // LINE only needs a 200; anything else triggers retries / errors in the console.
  return NextResponse.json({ ok: true });
}
