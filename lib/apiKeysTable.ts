import "server-only";
import { db } from "@/lib/db";

/** Prisma P2021 / Postgres "relation does not exist" when `api_keys` was never pushed. */
export function isMissingApiKeysTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  return (
    code === "P2021" ||
    (/api_keys/i.test(message) && /does not exist|relation/i.test(message))
  );
}

/**
 * Idempotent DDL so mint/list work even if `prisma db push` never applied ApiKey.
 * Matches `model ApiKey` / `@@map("api_keys")`.
 */
export async function ensureApiKeysTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "api_keys" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "keyPrefix" TEXT NOT NULL,
      "keyHash" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "revokedAt" TIMESTAMP(3),
      "lastUsedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
    )
  `);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_keyHash_key" ON "api_keys"("keyHash")`,
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "api_keys_userId_idx" ON "api_keys"("userId")`,
  );
}

export async function withApiKeysTable<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isMissingApiKeysTable(error)) throw error;
    await ensureApiKeysTable();
    return fn();
  }
}
