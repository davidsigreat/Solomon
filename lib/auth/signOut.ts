import { auth } from "@/lib/auth/server";

/**
 * Neon server signOut — revokes the upstream session.
 * Browser cookie clearing is applied as Set-Cookie on the Route Response
 * (see expireAuthCookies.ts). next/headers cookies().set does not emit
 * working expire headers for __Secure-neon-auth*.
 */
export async function runNeonSignOut(): Promise<void> {
  await auth.signOut();
}
