import { NextResponse } from "next/server";
import { getApiAuth, requireApiEditor } from "@/lib/apiAuth";
import { db } from "@/lib/db";
import { SprintMode } from "@prisma/client";

export async function GET(req: Request) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const mode = searchParams.get("mode");

  const sprints = await db.sprintSession.findMany({
    where: {
      userId: auth.userId,
      ...(projectId ? { projectId } : {}),
      ...(mode ? { mode: mode as SprintMode } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ sprints });
}

export async function POST(req: Request) {
  const auth = await requireApiEditor(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { taskName, projectId, duration, mode, completed } = await req.json();
  if (!duration) return NextResponse.json({ error: "duration is required" }, { status: 400 });

  const sprint = await db.sprintSession.create({
    data: {
      taskName: taskName || null,
      projectId: projectId || null,
      duration,
      mode: (mode ?? "FOCUS") as SprintMode,
      completed: completed ?? true,
      userId: auth.userId,
    },
  });
  return NextResponse.json({ sprint }, { status: 201 });
}
