import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/getUser";
import { withApiKeysTable } from "@/lib/apiKeysTable";
import { db } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthorizedUser();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

    const { id } = await params;
    const key = await withApiKeysTable(() =>
      db.apiKey.findUnique({ where: { id }, select: { userId: true } }),
    );
    if (!key || key.userId !== auth.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await withApiKeysTable(() =>
      db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } }),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not revoke key" }, { status: 500 });
  }
}
