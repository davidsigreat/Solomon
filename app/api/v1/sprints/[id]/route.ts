import { NextResponse } from "next/server";
import { getApiAuth, requireApiEditor } from "@/lib/apiAuth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const sprint = await db.sprintSession.findFirst({ where: { id, userId: auth.userId } });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ sprint });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireApiEditor(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const sprint = await db.sprintSession.findFirst({ where: { id, userId: auth.userId } });
  if (!sprint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.sprintSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
