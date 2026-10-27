import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { publishConversation, publishDelete } from "@/lib/pusher";
import { isStaffUsername } from "@/lib/staff";
import { getStore } from "@/lib/store";
import { CONV_ID, type ConversationFlags } from "@/lib/types";

type Params = { params: Promise<{ userId: string }> };

async function agentAndId(params: Params["params"]) {
  const session = await getSession();
  if (session?.role !== "agent") return { error: unauthorized() };
  const { userId } = await params;
  if (!CONV_ID.test(userId)) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  return { userId };
}

/**
 * Pin / mute / assign. Body: { pinned?: boolean, muted?: boolean, assignee?: string | null }
 * (null unassigns; a name must be on the staff list).
 */
export async function PATCH(req: Request, { params }: Params) {
  const { error, userId } = await agentAndId(params);
  if (error) return error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const flags: ConversationFlags = {};
  if (typeof body?.pinned === "boolean") flags.pinned = body.pinned;
  if (typeof body?.muted === "boolean") flags.muted = body.muted;
  if (body?.assignee === null) flags.assignee = null;
  else if (typeof body?.assignee === "string") {
    if (!isStaffUsername(body.assignee)) return NextResponse.json({ error: "not_staff" }, { status: 400 });
    flags.assignee = body.assignee;
  }
  if (Object.keys(flags).length === 0) return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });

  const conversation = await getStore().setFlags(userId!, flags);
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await publishConversation(conversation);
  return NextResponse.json({ conversation });
}

/** Deletes the conversation and its history from the webchat (not from the user's LINE app). */
export async function DELETE(_req: Request, { params }: Params) {
  const { error, userId } = await agentAndId(params);
  if (error) return error;
  await getStore().deleteConversation(userId!);
  await publishDelete(userId!);
  return NextResponse.json({ ok: true });
}
