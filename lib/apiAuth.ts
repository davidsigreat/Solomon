import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashApiKey } from "@/lib/apiKey";
import { resolveAuth, type AuthResult, type AuthedUser } from "@/lib/getUser";

const LIVE_KEY_PREFIX = "sk_live_";

export type { AuthResult, AuthedUser };

export type PublicOk<T> = { ok: true; status?: number; data: T };
export type PublicErr = { ok: false; status: number; error: string };
export type PublicResult<T> = PublicOk<T> | PublicErr;

/** Pulls the raw token from `Authorization: Bearer …`. */
export function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const key = header.slice(7).trim();
  return key.length > 0 ? key : null;
}

/**
 * Resolves a minted `sk_live_*` key through `ApiKey` + `resolveAuth`.
 * Revoked or unknown keys are 401. Touches `lastUsedAt` on a valid key.
 * Session cookies are ignored — API-key auth only.
 */
export async function authenticateApiKey(key: string): Promise<AuthResult> {
  if (!key.startsWith(LIVE_KEY_PREFIX)) return { ok: false, status: 401 };

  const record = await db.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
  if (!record || record.revokedAt) return { ok: false, status: 401 };

  await db.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return resolveAuth(record.email, record.userId);
}

/** Authenticates a request bearing `Authorization: Bearer sk_live_...`. */
export async function getApiAuth(req: Request): Promise<AuthResult> {
  const key = extractBearerToken(req);
  if (!key) return { ok: false, status: 401 };
  return authenticateApiKey(key);
}

export function apiAuthError(auth: { ok: false; status: 401 | 403 }) {
  return NextResponse.json(
    { error: auth.status === 403 ? "Forbidden" : "Unauthorized" },
    { status: auth.status },
  );
}

export function apiError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export function toJsonResponse<T>(result: PublicResult<T>) {
  if (!result.ok) return apiError(result.status, result.error);
  return NextResponse.json(result.data, { status: result.status ?? 200 });
}

