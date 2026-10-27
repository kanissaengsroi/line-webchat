import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return unauthorized();
  const conversations = await getStore().listConversations();
  return NextResponse.json({ conversations });
}
