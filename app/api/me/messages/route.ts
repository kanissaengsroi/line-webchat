import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { publishMessage } from "@/lib/pusher";
import { getStore } from "@/lib/store";
import { MAX_TEXT, type ChatMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

const CLIENT_ID = /^[a-zA-Z0-9_-]{8,64}$/;

async function customer() {
  const session = await getSession();
  return session?.role === "customer" && session.convId ? { ...session, convId: session.convId } : null;
}

/** The signed-in customer's own thread with the OA. */
export async function GET() {
  const session = await customer();
  if (!session) return unauthorized();
  const messages = await getStore().getMessages(session.convId);
  return NextResponse.json({ messages });
}

/** A customer message typed on the website. Agents see it in the inbox like any LINE message. */
export async function POST(req: Request) {
  const session = await customer();
  if (!session) return unauthorized();

  const body = (await req.json().catch(() => null)) as { text?: unknown; clientId?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (text.length > MAX_TEXT) return NextResponse.json({ error: "too_long" }, { status: 400 });
  const id =
    typeof body?.clientId === "string" && CLIENT_ID.test(body.clientId)
      ? body.clientId
      : crypto.randomUUID();

  const store = getStore();
  const existing = await store.getConversation(session.convId);
  if (!existing || (session.picture && existing.pictureUrl !== session.picture)) {
    await store.upsertProfile(session.convId, {
      displayName: existing?.displayName && !session.picture ? existing.displayName : session.username,
      pictureUrl: session.picture ?? existing?.pictureUrl,
    });
  }

  const message: ChatMessage = { id, dir: "in", type: "text", text, at: Date.now(), via: "web" };
  const conversation = await store.appendMessage(session.convId, message);
  await publishMessage({ conversation, message });
  return NextResponse.json({ message });
}
