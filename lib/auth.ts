import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSessionToken, type Session } from "./session";

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
