import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { LineApiError, pushText } from "@/lib/line";
import { publishMessage } from "@/lib/pusher";
import { getStore } from "@/lib/store";
import { LINE_USER_ID, MAX_TEXT, type ChatMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

const CLIENT_ID = /^[a-zA-Z0-9_-]{8,64}$/;

export async function GET(_req: Request, { params }: Params) {
  if (!(await getSession())) return unauthorized();
  const { userId } = await params;
  if (!LINE_USER_ID.test(userId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
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
  if (!LINE_USER_ID.test(userId)) return NextResponse.json({ error: "not_found" }, { status: 404 });

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

  try {
    // LINE requires the retry key to be a UUID; derive a stable one from the client id.
    await pushText(userId, text, toUuid(id));
  } catch (err) {
    const status = err instanceof LineApiError ? err.status : 0;
    console.error("[send] LINE push failed", status, err);
    return NextResponse.json(
      { error: "line_push_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  const message: ChatMessage = { id, dir: "out", type: "text", text, at: Date.now(), agent: session.username };
  const conversation = await store.appendMessage(userId, message);
  await publishMessage({ conversation, message });
  return NextResponse.json({ conversation, message });
}

/** Formats the first 32 hex chars of a SHA-256 of the id as a UUID. */
function toUuid(id: string): string {
  const hex = createHash("sha256").update(id).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
