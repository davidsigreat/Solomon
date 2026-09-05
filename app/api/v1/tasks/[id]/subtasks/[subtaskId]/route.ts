import { NextResponse } from "next/server";
import { getApiAuth, apiAuthError, apiError } from "@/lib/apiAuth";
import { requireProjectMutate } from "@/lib/projectAccess";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string; subtaskId: string }> };

async function mutateAccess(taskId: string, auth: Parameters<typeof requireProjectMutate>[1]) {
  const task = await db.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) return { ok: false as const, status: 404, error: "Not found" };
  return requireProjectMutate(task.projectId, auth);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id, subtaskId } = await params;
  const access = await mutateAccess(id, auth);
  if (!access.ok) return apiError(access.status, access.error);

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
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id, subtaskId } = await params;
  const access = await mutateAccess(id, auth);
  if (!access.ok) return apiError(access.status, access.error);

  await db.subtask.delete({ where: { id: subtaskId } });
  return NextResponse.json({ ok: true });
}
