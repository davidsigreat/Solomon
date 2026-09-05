import { cookies } from "next/headers";
import { auth } from "@/lib/auth/server";

/** Neon Auth HTTP-only cookies, including the signed session_data cache. */
const NEON_AUTH_COOKIE_PREFIX = "__Secure-neon-auth";

/**
 * Official Neon server sign-out (clears upstream session + session_data cache),
 * then expire any leftover Neon Auth cookies so getSession / /api/auth/me
 * cannot keep serving a cached identity.
 */
export async function signOutAndClearCookies(): Promise<{ ok: true }> {
  try {
    await auth.signOut();
  } catch {
    // Still drop local cookies — otherwise the 5-minute session_data cache
    // keeps /api/auth/me and the Wave 1c proxy treating the user as signed in.
  }
  await expireNeonAuthCookies();
  return { ok: true };
}

async function expireNeonAuthCookies() {
  const store = await cookies();
  for (const cookie of store.getAll()) {
    if (!cookie.name.startsWith(NEON_AUTH_COOKIE_PREFIX)) continue;
    store.set(cookie.name, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  }
}
