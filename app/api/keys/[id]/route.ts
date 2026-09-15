import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/getUser";
import { db } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const key = await db.apiKey.findUnique({ where: { id }, select: { userId: true } });
  if (!key || key.userId !== auth.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
