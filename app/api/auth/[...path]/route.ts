import { auth } from "@/lib/auth/server";
import { signOutAndClearCookies } from "@/lib/auth/signOut";

const { GET, POST: proxyPost } = auth.handler();

export { GET };

export async function POST(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = (await context.params).path.join("/");
  // Client authClient.signOut() POSTs here. The generic proxy does not reliably
  // clear the Next.js session_data cookie; use the server signOut path instead.
  if (path === "sign-out") {
    await signOutAndClearCookies();
    return Response.json({ success: true });
  }
  return proxyPost(request, context);
}
