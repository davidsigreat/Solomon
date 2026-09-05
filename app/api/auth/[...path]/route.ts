import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { applyExpireSetCookies } from "@/lib/auth/expireAuthCookies";
import { runNeonSignOut } from "@/lib/auth/signOut";

const { GET, POST: proxyPost } = auth.handler();

export { GET };

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = (await context.params).path.join("/");
  if (path !== "sign-out") return proxyPost(request, context);

  const cookieHeader = request.headers.get("cookie");
  const host = request.headers.get("host");

  // Official Neon proxy first (upstream sign-out + any Set-Cookie it returns).
  const neonRes = await proxyPost(request, context);
  try {
    await runNeonSignOut();
  } catch {
    // Cookie wipe below still runs.
  }

  const response = new NextResponse(neonRes.body, {
    status: neonRes.status,
    statusText: neonRes.statusText,
    headers: neonRes.headers,
  });
  applyExpireSetCookies(response, cookieHeader, host);
  return response;
}
