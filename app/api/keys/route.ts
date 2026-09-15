import { NextResponse } from "next/server";
import { getAuthorizedUser, requireEditor } from "@/lib/getUser";
import { generateApiKey } from "@/lib/apiKey";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ keys: [] }, { status: auth.status });

  const keys = await db.apiKey.findMany({
    where: { userId: auth.userId },
    select: { id: true, name: true, keyPrefix: true, revokedAt: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { key, keyHash, keyPrefix } = generateApiKey();
  const record = await db.apiKey.create({
    data: { name: name.trim(), keyHash, keyPrefix, userId: auth.userId, email: auth.email },
  });

  // Full key is only ever returned here — the DB only ever stores its hash.
  return NextResponse.json({ key, id: record.id, name: record.name, keyPrefix, createdAt: record.createdAt });
}
