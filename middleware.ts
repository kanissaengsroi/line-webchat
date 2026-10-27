import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken, type Role } from "@/lib/session";

const PUBLIC_API = ["/api/auth/", "/api/line/webhook"];
const SHARED = ["/api/pusher/auth"];
// Customers (LINE Login) only reach their own chat; everything else belongs to agents.
const CUSTOMER_ONLY = ["/chat", "/api/me"];

const home = (role: Role) => (role === "customer" ? "/chat" : "/");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const session = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL(home(session.role), req.url)) : NextResponse.next();
  }
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (SHARED.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const customerPath = CUSTOMER_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (customerPath === (session.role === "customer")) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.redirect(new URL(home(session.role), req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
