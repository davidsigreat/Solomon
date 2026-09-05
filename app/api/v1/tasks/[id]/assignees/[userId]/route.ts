import { NextResponse } from "next/server";
import { getApiAuth, apiAuthError, apiError } from "@/lib/apiAuth";
import { requireProjectMutate } from "@/lib/projectAccess";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id, userId } = await params;
  const task = await db.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) return apiError(404, "Not found");

  const access = await requireProjectMutate(task.projectId, auth);
  if (!access.ok) return apiError(access.status, access.error);

  await db.taskAssignee.deleteMany({ where: { taskId: id, userId } });
  return NextResponse.json({ ok: true });
}
