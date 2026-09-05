import { NextResponse } from "next/server";
import { applyExpireSetCookies } from "@/lib/auth/expireAuthCookies";
import { runNeonSignOut } from "@/lib/auth/signOut";

export const dynamic = "force-dynamic";

function logoutRedirect(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  applyExpireSetCookies(
    response,
    request.headers.get("cookie"),
    request.headers.get("host"),
  );
  return response;
}

/** Native Profile form POST. Always 303 /login with expire Set-Cookie. */
export async function POST(request: Request) {
  try {
    await runNeonSignOut();
  } catch {
    // Still redirect + expire cookies.
  }
  return logoutRedirect(request);
}
