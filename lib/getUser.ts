import "server-only";
import { cache } from "react";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";

export type UserRole = "VIEWER" | "MEMBER" | "ADMIN";

export type AuthResult =
  | { ok: true; userId: string; email: string; role: UserRole; isAdmin: boolean; canEdit: boolean }
  | { ok: false; status: 401 | 403; error: string; reason: "no_session" | "not_whitelisted" };

const getSession = cache(() => auth.getSession());

// Module-level auth cache — eliminates the appUser DB lookup on every API request.
// TTL: 60s. Stale after role change but acceptable for non-security-critical UX.
const AUTH_CACHE = new Map<string, { role: UserRole; exp: number }>();
const CACHE_TTL  = 60_000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function ownerEmail(): string | null {
  const value = process.env.AUTHORIZED_EMAIL?.trim().toLowerCase();
  return value || null;
}

function okAuth(userId: string, email: string, role: UserRole): AuthResult {
  return { ok: true, userId, email, role, isAdmin: role === "ADMIN", canEdit: role !== "VIEWER" };
}

function denied(status: 401 | 403): AuthResult {
  return status === 401
    ? { ok: false, status, error: "Sign in required.", reason: "no_session" }
    : {
        ok: false,
        status,
        error: "Signed in, but this account is not authorized for the app.",
        reason: "not_whitelisted",
      };
}

async function findAppUser(email: string) {
  return db.appUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
}

/** Insert AppUser for a cookie-authenticated Neon Auth identity. */
async function provisionAppUser(email: string, role: UserRole) {
  try {
    return await db.appUser.create({
      data: { email, role, note: "auto-provisioned on first signed-in request" },
    });
  } catch {
    return findAppUser(email);
  }
}

// Shared by cookie-session auth and API-key auth — resolves role for an
// already-verified Neon Auth identity (email/userId pair).
// Owner is AUTHORIZED_EMAIL (case-insensitive) and is not stored in AppUser.
// Preview deploys often omit that env var; signed-in users are then
// auto-provisioned so Command Center is not a silent 403.
export async function resolveAuth(email: string, userId: string): Promise<AuthResult> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return denied(403);

  const owner = ownerEmail();
  if (owner && normalized === owner) {
    return okAuth(userId, normalized, "ADMIN");
  }

  const cached = AUTH_CACHE.get(normalized);
  if (cached && cached.exp > Date.now()) {
    return okAuth(userId, normalized, cached.role);
  }

  let appUser = await findAppUser(normalized);
  if (!appUser) {
    const role: UserRole = owner ? "MEMBER" : "ADMIN";
    appUser = await provisionAppUser(normalized, role);
  }
  if (!appUser) return denied(403);

  const role = appUser.role as UserRole;
  AUTH_CACHE.set(normalized, { role, exp: Date.now() + CACHE_TTL });
  return okAuth(userId, normalized, role);
}

export async function getAuthorizedUser(): Promise<AuthResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await getSession();
  const user = result?.user ?? result?.data?.user;
  if (!user?.email) return denied(401);

  return resolveAuth(user.email, user.id);
}

// Invalidate cache when admin changes a user's role
export function invalidateAuthCache(email: string) {
  AUTH_CACHE.delete(normalizeEmail(email));
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await getAuthorizedUser();
  if (!result.ok) return result;
  if (!result.isAdmin) return denied(403);
  return result;
}

export async function requireEditor(): Promise<AuthResult> {
  const result = await getAuthorizedUser();
  if (!result.ok) return result;
  if (!result.canEdit) return denied(403);
  return result;
}
