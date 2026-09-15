import { NextResponse } from "next/server";
import { requireApiEditor } from "@/lib/apiAuth";
import { getProjectRole } from "@/lib/projectAccess";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireApiEditor(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id, userId } = await params;
  const task = await db.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getProjectRole(task.projectId, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.taskAssignee.deleteMany({ where: { taskId: id, userId } });
  return NextResponse.json({ ok: true });
}
