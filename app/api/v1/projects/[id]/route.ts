import { NextResponse } from "next/server";
import { getApiAuth, apiAuthError, apiError } from "@/lib/apiAuth";
import { getProjectRole, requireProjectMutate } from "@/lib/projectAccess";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id } = await params;
  const role = await getProjectRole(id, auth);
  if (!role) return apiError(404, "Not found");

  const project = await db.project.findUnique({ where: { id }, include: { tasks: true } });
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id } = await params;
  const access = await requireProjectMutate(id, auth);
  if (!access.ok) return apiError(access.status, access.error);

  const body = await req.json();
  const project = await db.project.update({
    where: { id },
    data: {
      ...(body.name !== undefined        && { name: body.name }),
      ...(body.color !== undefined       && { color: body.color }),
      ...(body.description !== undefined && { description: body.description }),
    },
  });
  return NextResponse.json({ project });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);
  if (!auth.canEdit) return apiError(403, "Forbidden");

  const { id } = await params;
  const role = await getProjectRole(id, auth);
  if (!role) return apiError(404, "Not found");
  if (role !== "OWNER") return apiError(403, "Only owner can delete");

  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
