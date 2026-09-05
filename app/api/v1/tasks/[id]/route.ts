import { NextResponse } from "next/server";
import { getApiAuth, apiAuthError, apiError, toJsonResponse } from "@/lib/apiAuth";
import { getProjectRole, requireProjectMutate } from "@/lib/projectAccess";
import { TASK_INCLUDE, upsertPublicTask } from "@/lib/solomonPublic";
import { db } from "@/lib/db";
import { enrichOneTask } from "@/lib/enrichAssignees";

type Ctx = { params: Promise<{ id: string }> };

async function resolveTaskProject(id: string) {
  return db.task.findUnique({ where: { id }, select: { projectId: true } });
}

export async function GET(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id } = await params;
  const existing = await resolveTaskProject(id);
  if (!existing) return apiError(404, "Not found");

  const role = await getProjectRole(existing.projectId, auth);
  if (!role) return apiError(404, "Not found");

  const task = await db.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  if (!task) return apiError(404, "Not found");
  return NextResponse.json({ task: await enrichOneTask(task) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id } = await params;
  const body = await req.json();
  return toJsonResponse(await upsertPublicTask(auth, { ...body, id }));
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id } = await params;
  const existing = await resolveTaskProject(id);
  if (!existing) return apiError(404, "Not found");

  const access = await requireProjectMutate(existing.projectId, auth);
  if (!access.ok) return apiError(access.status, access.error);

  await db.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
