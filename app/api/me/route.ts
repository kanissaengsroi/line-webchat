import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { getBotInfo } from "@/lib/line";

export const dynamic = "force-dynamic";

/** The signed-in customer and the OA they chat with, for pages rendered on the client (LIFF). */
export async function GET() {
  const session = await getSession();
  if (session?.role !== "customer" || !session.convId) return unauthorized();
  const bot = await getBotInfo();
  return NextResponse.json({
    convId: session.convId,
    username: session.username,
    picture: session.picture,
    oa: { name: bot?.displayName ?? "LINE OA", pictureUrl: bot?.pictureUrl, id: bot?.basicId ?? "oa" },
  });
}
