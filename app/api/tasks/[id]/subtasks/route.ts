import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/getUser";
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
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const denied = await requireTaskEditor(id, auth);
  if (denied) return denied;

  const body = await req.json();

  // Batch creation: { titles: string[] }
  if (Array.isArray(body.titles)) {
    await db.subtask.createMany({
      data: body.titles.filter((t: string) => t.trim()).map((title: string) => ({ title, taskId: id })),
    });
    const subtasks = await db.subtask.findMany({ where: { taskId: id }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ subtasks });
  }

  const subtask = await db.subtask.create({
    data: { title: body.title, taskId: id, description: body.description ?? null },
  });
  return NextResponse.json({ subtask });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const denied = await requireTaskEditor(id, auth);
  if (denied) return denied;

  const { subtaskId, completed, title, description } = await req.json();
  // Scope to the task in the URL so an id from another task can't be edited.
  const { count } = await db.subtask.updateMany({
    where: { id: subtaskId, taskId: id },
    data: {
      ...(completed !== undefined && { completed }),
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
    },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const subtask = await db.subtask.findUnique({ where: { id: subtaskId } });
  return NextResponse.json({ subtask });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const denied = await requireTaskEditor(id, auth);
  if (denied) return denied;

  const { subtaskId } = await req.json();
  await db.subtask.deleteMany({ where: { id: subtaskId, taskId: id } });
  return NextResponse.json({ ok: true });
}
