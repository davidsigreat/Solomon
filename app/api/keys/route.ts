import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/getUser";
import { generateApiKey } from "@/lib/apiKey";
import { withApiKeysTable } from "@/lib/apiKeysTable";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const auth = await getAuthorizedUser();
    if (!auth.ok) return NextResponse.json({ keys: [] }, { status: auth.status });

    const keys = await withApiKeysTable(() =>
      db.apiKey.findMany({
        where: { userId: auth.userId },
        select: { id: true, name: true, keyPrefix: true, revokedAt: true, lastUsedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    );
    return NextResponse.json({ keys });
  } catch {
    return NextResponse.json({ keys: [], error: "Could not load keys" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthorizedUser();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const { key, keyHash, keyPrefix } = generateApiKey();
    const record = await withApiKeysTable(() =>
      db.apiKey.create({
        data: { name, keyHash, keyPrefix, userId: auth.userId, email: auth.email },
      }),
    );

    // Full key is only ever returned here — the DB only ever stores its hash.
    return NextResponse.json({ key, id: record.id, name: record.name, keyPrefix, createdAt: record.createdAt });
  } catch {
    return NextResponse.json({ error: "Could not create key" }, { status: 500 });
  }
}
