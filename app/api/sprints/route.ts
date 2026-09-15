import { NextResponse } from "next/server";
import { getAuthorizedUser, requireEditor } from "@/lib/getUser";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ sprints: [] }, { status: auth.status });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sprints = await db.sprintSession.findMany({
    where: { userId: auth.userId, createdAt: { gte: today }, mode: "FOCUS" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sprints });
}

export async function POST(req: Request) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { taskName, projectId, duration, mode } = await req.json();
  const sprint = await db.sprintSession.create({
    data: { taskName: taskName || null, projectId: projectId || null, duration, mode: mode ?? "FOCUS", userId: auth.userId },
  });

  return NextResponse.json({ sprint });
}

export async function DELETE(req: Request) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  if (!auth.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 });

  await db.sprintSession.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ deleted: ids.length });
}
