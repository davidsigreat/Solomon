import { NextResponse } from "next/server";
import { requireApiEditor } from "@/lib/apiAuth";
import { getProjectRole } from "@/lib/projectAccess";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string; subtaskId: string }> };

async function resolveTaskAccess(id: string, auth: { userId: string; isAdmin: boolean }) {
  const task = await db.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) return { role: null };
  return { role: await getProjectRole(task.projectId, auth) };
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireApiEditor(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id, subtaskId } = await params;
  const { role } = await resolveTaskAccess(id, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, description, completed } = await req.json();
  const subtask = await db.subtask.update({
    where: { id: subtaskId },
    data: {
      ...(title !== undefined       && { title }),
      ...(description !== undefined && { description }),
      ...(completed !== undefined   && { completed }),
    },
  });
  return NextResponse.json({ subtask });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireApiEditor(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id, subtaskId } = await params;
  const { role } = await resolveTaskAccess(id, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.subtask.delete({ where: { id: subtaskId } });
  return NextResponse.json({ ok: true });
}
