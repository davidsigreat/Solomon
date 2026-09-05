import { NextResponse } from "next/server";
import { applyExpireSetCookies } from "@/lib/auth/expireAuthCookies";
import { runNeonSignOut } from "@/lib/auth/signOut";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await runNeonSignOut();
  } catch {
    // Still emit expire Set-Cookie — cookies().set inside auth.signOut() does
    // not reach the browser when we return a new NextResponse.
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  applyExpireSetCookies(
    response,
    request.headers.get("cookie"),
    request.headers.get("host"),
  );
  return response;
}
