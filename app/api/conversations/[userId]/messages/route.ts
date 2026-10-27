import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { LineApiError, pushText, retryKeyFor } from "@/lib/line";
import { publishMessage } from "@/lib/pusher";
import { getStore } from "@/lib/store";
import { CONV_ID, MAX_TEXT, channelOf, type ChatMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

const CLIENT_ID = /^[a-zA-Z0-9_-]{8,64}$/;

export async function GET(_req: Request, { params }: Params) {
  if (!(await getSession())) return unauthorized();
  const { userId } = await params;
  if (!CONV_ID.test(userId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const store = getStore();
  const [conversation, messages] = await Promise.all([
    store.getConversation(userId),
    store.getMessages(userId),
  ]);
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ conversation, messages });
}

export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { userId } = await params;
  if (!CONV_ID.test(userId)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { text?: unknown; clientId?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (text.length > MAX_TEXT) return NextResponse.json({ error: "too_long" }, { status: 400 });
  const id =
    typeof body?.clientId === "string" && CLIENT_ID.test(body.clientId)
      ? body.clientId
      : crypto.randomUUID();

  const store = getStore();
  const existing = await store.getConversation(userId);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const message: ChatMessage = { id, dir: "out", type: "text", text, at: Date.now(), agent: session.username };

  // Website guests only get replies on the website. LINE users get them in the LINE app,
  // and on the website too if they chat there.
  if (channelOf(userId) === "line") {
    try {
      await pushText(userId, text, retryKeyFor(id));
    } catch (err) {
      const status = err instanceof LineApiError ? err.status : 0;
      console.error("[send] LINE push failed", status, err);
      if (!existing.web) {
        return NextResponse.json(
          { error: "line_push_failed", detail: err instanceof Error ? err.message : String(err) },
          { status: 502 },
        );
      }
      // e.g. they signed in with LINE but never added the OA as a friend.
      message.webOnly = true;
    }
  }
  const conversation = await store.appendMessage(userId, message);
  await publishMessage({ conversation, message });
  return NextResponse.json({ conversation, message });
}
