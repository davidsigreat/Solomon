import { NextResponse } from "next/server";
import { getApiAuth, requireApiEditor } from "@/lib/apiAuth";
import { getProjectRole } from "@/lib/projectAccess";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

async function resolveTaskAccess(id: string, auth: { userId: string; isAdmin: boolean }) {
  const task = await db.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) return { role: null };
  return { role: await getProjectRole(task.projectId, auth) };
}

export async function GET(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const { role } = await resolveTaskAccess(id, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const subtasks = await db.subtask.findMany({ where: { taskId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ subtasks });
}

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireApiEditor(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const { role } = await resolveTaskAccess(id, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, description } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const subtask = await db.subtask.create({ data: { title, description: description ?? null, taskId: id } });
  return NextResponse.json({ subtask }, { status: 201 });
}
