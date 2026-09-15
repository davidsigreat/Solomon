import { NextResponse } from "next/server";
import { getApiAuth, requireApiEditor } from "@/lib/apiAuth";
import { getProjectRole } from "@/lib/projectAccess";
import { db } from "@/lib/db";
import { enrichAssignees } from "@/lib/enrichAssignees";

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

  const assignees = await db.taskAssignee.findMany({ where: { taskId: id } });
  const [enriched] = await enrichAssignees([{ assignees }]);
  return NextResponse.json({ assignees: enriched.assignees });
}

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireApiEditor(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const { role } = await resolveTaskAccess(id, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  try {
    await db.taskAssignee.create({ data: { taskId: id, userId } });
  } catch {} // already assigned — no-op

  return NextResponse.json({ ok: true }, { status: 201 });
}
