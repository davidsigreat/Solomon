import { NextResponse } from "next/server";
import { getApiAuth, apiAuthError, apiError } from "@/lib/apiAuth";
import { getProjectRole, requireProjectMutate } from "@/lib/projectAccess";
import { db } from "@/lib/db";
import { enrichAssignees } from "@/lib/enrichAssignees";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id } = await params;
  const task = await db.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) return apiError(404, "Not found");
  const role = await getProjectRole(task.projectId, auth);
  if (!role) return apiError(404, "Not found");

  const assignees = await db.taskAssignee.findMany({ where: { taskId: id } });
  const [enriched] = await enrichAssignees([{ assignees }]);
  return NextResponse.json({ assignees: enriched.assignees });
}

export async function POST(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id } = await params;
  const task = await db.task.findUnique({ where: { id }, select: { projectId: true } });
  if (!task) return apiError(404, "Not found");
  const access = await requireProjectMutate(task.projectId, auth);
  if (!access.ok) return apiError(access.status, access.error);

  const { userId } = await req.json();
  if (!userId) return apiError(400, "userId is required");

  try {
    await db.taskAssignee.create({ data: { taskId: id, userId } });
  } catch {
    // already assigned — no-op
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
