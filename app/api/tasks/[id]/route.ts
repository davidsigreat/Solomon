import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/getUser";
import { getProjectRole, resolveTaskAccess } from "@/lib/projectAccess";
import { db } from "@/lib/db";
import { enrichOneTask } from "@/lib/enrichAssignees";

const TASK_INCLUDE = {
  project: true,
  subtasks: { orderBy: { createdAt: "asc" as const } },
  assignees: true,
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const { role } = await resolveTaskAccess(id, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const task = await db.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task: await enrichOneTask(task) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const { task: current, role } = await resolveTaskAccess(id, auth);
  if (!role || !current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  // Moving to another project requires edit rights on the target too.
  if (body.projectId && body.projectId !== current.projectId) {
    const targetRole = await getProjectRole(body.projectId, auth);
    if (!targetRole) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (targetRole === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const task = await db.task.update({
    where: { id },
    data: {
      ...(body.title !== undefined       && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined      && { status: body.status }),
      ...(body.priority !== undefined    && { priority: body.priority }),
      ...(body.projectId                 && { projectId: body.projectId }),
      ...(body.startDate !== undefined   && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.dueDate !== undefined     && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
    },
    include: TASK_INCLUDE,
  });

  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const { role } = await resolveTaskAccess(id, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
