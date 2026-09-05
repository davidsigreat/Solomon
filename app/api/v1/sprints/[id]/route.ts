import { NextResponse } from "next/server";
import { getApiAuth, apiAuthError, apiError } from "@/lib/apiAuth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { id } = await params;
  const sprint = await db.sprintSession.findFirst({ where: { id, userId: auth.userId } });
  if (!sprint) return apiError(404, "Not found");
  return NextResponse.json({ sprint });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);
  if (!auth.canEdit) return apiError(403, "Forbidden");

  const { id } = await params;
  const sprint = await db.sprintSession.findFirst({ where: { id, userId: auth.userId } });
  if (!sprint) return apiError(404, "Not found");

  await db.sprintSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
