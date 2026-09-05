import { NextResponse } from "next/server";
import { getApiAuth, apiAuthError, apiError } from "@/lib/apiAuth";
import { getProjectRole, requireProjectMutate } from "@/lib/projectAccess";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id } = await params;
  const task = await db.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) return apiError(404, "Not found");
  const role = await getProjectRole(task.projectId, auth);
  if (!role) return apiError(404, "Not found");

  const subtasks = await db.subtask.findMany({ where: { taskId: id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ subtasks });
}

export async function POST(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id } = await params;
  const task = await db.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) return apiError(404, "Not found");
  const access = await requireProjectMutate(task.projectId, auth);
  if (!access.ok) return apiError(access.status, access.error);

  const { title, description } = await req.json();
  if (!title?.trim()) return apiError(400, "title is required");

  const subtask = await db.subtask.create({ data: { title, description: description ?? null, taskId: id } });
  return NextResponse.json({ subtask }, { status: 201 });
}
