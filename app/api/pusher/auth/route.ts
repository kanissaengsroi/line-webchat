import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { INBOX_CHANNEL, customerChannel, getPusher } from "@/lib/pusher";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  const pusher = getPusher();
  if (!pusher) return NextResponse.json({ error: "pusher_not_configured" }, { status: 503 });

  const form = await req.formData();
  const socketId = String(form.get("socket_id") ?? "");
  const channel = String(form.get("channel_name") ?? "");
  const allowed =
    session.role === "agent"
      ? channel === INBOX_CHANNEL
      : !!session.convId && channel === customerChannel(session.convId);
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json(pusher.authorizeChannel(socketId, channel));
}
