import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { publishRead } from "@/lib/pusher";
import { getStore } from "@/lib/store";
import { CONV_ID } from "@/lib/types";

type Params = { params: Promise<{ userId: string }> };

export async function POST(_req: Request, { params }: Params) {
  if (!(await getSession())) return unauthorized();
  const { userId } = await params;
  if (!CONV_ID.test(userId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await getStore().markRead(userId);
  await publishRead(userId);
  return NextResponse.json({ ok: true });
}
