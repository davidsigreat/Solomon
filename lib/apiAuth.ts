import "server-only";
import { db } from "@/lib/db";
import { hashApiKey } from "@/lib/apiKey";
import { resolveAuth, type AuthResult } from "@/lib/getUser";

/** Authenticates a request bearing `Authorization: Bearer sk_live_...`. */
export async function getApiAuth(req: Request): Promise<AuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!key) return { ok: false, status: 401, error: "Sign in required.", reason: "no_session" };

  const record = await db.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
  if (!record || record.revokedAt) return { ok: false, status: 401, error: "Sign in required.", reason: "no_session" };

  db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return resolveAuth(record.email, record.userId);
}
