import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  USERNAME_PATTERN,
  createSessionToken,
} from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { username?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json({ error: "invalid_username" }, { status: 400 });
  }
  const res = NextResponse.json({ username });
  res.cookies.set(SESSION_COOKIE, await createSessionToken({ username }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
