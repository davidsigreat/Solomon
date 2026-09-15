import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/getUser";
import { resolveTaskAccess } from "@/lib/projectAccess";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** 404 if task missing / no access, 403 if project VIEWER, else null. */
async function requireTaskEditor(id: string, auth: { userId: string; isAdmin: boolean }) {
  const { role } = await resolveTaskAccess(id, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const { id } = await params;

  const denied = await requireTaskEditor(id, auth);
  if (denied) return denied;

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  try {
    await db.taskAssignee.create({ data: { taskId: id, userId } });
  } catch {} // ignore duplicate

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const { id } = await params;

  const denied = await requireTaskEditor(id, auth);
  if (denied) return denied;

  const { userId } = await req.json();
  await db.taskAssignee.deleteMany({ where: { taskId: id, userId } });
  return NextResponse.json({ ok: true });
}
