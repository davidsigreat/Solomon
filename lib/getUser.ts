import "server-only";
import { cache } from "react";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";

export type UserRole = "VIEWER" | "MEMBER" | "ADMIN";

export type AuthResult =
  | { ok: true; userId: string; email: string; role: UserRole; isAdmin: boolean; canEdit: boolean }
  | { ok: false; status: 401 | 403 };

const getSession = cache(() => auth.getSession());

// Shared by cookie-session auth and API-key auth — resolves role for an
// already-verified identity (email/userId pair). Returns 403 if the email
// has no AppUser record (not whitelisted). Looked up per request so a
// demote/removal in the whitelist takes effect on the next call.
export async function resolveAuth(email: string, userId: string): Promise<AuthResult> {
  if (email === process.env.AUTHORIZED_EMAIL) {
    return { ok: true, userId, email, role: "ADMIN", isAdmin: true, canEdit: true };
  }

  const appUser = await db.appUser.findUnique({ where: { email } });
  if (!appUser) return { ok: false, status: 403 };

  const role = appUser.role as UserRole;
  return { ok: true, userId, email, role, isAdmin: role === "ADMIN", canEdit: role !== "VIEWER" };
}

export async function getAuthorizedUser(): Promise<AuthResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await getSession();
  const user = result?.user ?? result?.data?.user;
  if (!user?.email) return { ok: false, status: 401 };

  return resolveAuth(user.email, user.id);
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await getAuthorizedUser();
  if (!result.ok) return result;
  if (!result.isAdmin) return { ok: false, status: 403 };
  return result;
}

/** Session auth + AppUser VIEWER (canEdit=false) → 403. Use on every mutating cookie route. */
export async function requireEditor(): Promise<AuthResult> {
  const result = await getAuthorizedUser();
  if (!result.ok) return result;
  if (!result.canEdit) return { ok: false, status: 403 };
  return result;
}
