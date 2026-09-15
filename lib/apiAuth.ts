import "server-only";
import { db } from "@/lib/db";
import { hashApiKey } from "@/lib/apiKey";
import { resolveAuth, type AuthResult } from "@/lib/getUser";

/** Authenticates a request bearing `Authorization: Bearer sk_live_...`. */
export async function getApiAuth(req: Request): Promise<AuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!key) return { ok: false, status: 401 };

  const record = await db.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
  if (!record || record.revokedAt) return { ok: false, status: 401 };

  db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return resolveAuth(record.email, record.userId);
}

/** Bearer auth + AppUser VIEWER (canEdit=false) → 403. Use on every mutating /api/v1 route. */
export async function requireApiEditor(req: Request): Promise<AuthResult> {
  const result = await getApiAuth(req);
  if (!result.ok) return result;
  if (!result.canEdit) return { ok: false, status: 403 };
  return result;
}
