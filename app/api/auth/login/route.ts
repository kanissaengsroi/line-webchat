import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  USERNAME_PATTERN,
  createSessionToken,
  sessionCookieOptions,
  type Session,
} from "@/lib/session";
import { guestConvId, isStaffUsername } from "@/lib/staff";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: unknown; as?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 });
  }

  let session: Session;
  if (body?.as === "staff") {
    if (!isStaffUsername(username)) {
      return NextResponse.json({ error: "not_staff" }, { status: 403 });
    }
    session = { username, role: "agent" };
  } else {
    session = { username, role: "customer", convId: guestConvId(username) };
  }

  const res = NextResponse.json({ role: session.role });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(session), sessionCookieOptions);
  return res;
}
