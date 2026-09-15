import { NextResponse } from "next/server";
import { getAuthorizedUser, requireEditor } from "@/lib/getUser";
import { getProjectRole, projectAccessWhere } from "@/lib/projectAccess";
import { db } from "@/lib/db";
import { Priority, TaskStatus } from "@prisma/client";
import { enrichAssignees, enrichOneTask } from "@/lib/enrichAssignees";

const TASK_INCLUDE = {
  project: true,
  subtasks: { orderBy: { createdAt: "asc" as const } },
  assignees: true,
};

export async function GET(req: Request) {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ tasks: [] }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");

  // If specific project requested, verify access first
  if (projectId) {
    const role = await getProjectRole(projectId, auth);
    if (!role) return NextResponse.json({ tasks: [] });
  }

  const tasks = await db.task.findMany({
    where: {
      ...(projectId
        ? { projectId }
        : { project: projectAccessWhere(auth) }),
      ...(status ? { status: status as TaskStatus } : {}),
    },
    include: TASK_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tasks: await enrichAssignees(tasks) });
}

export async function POST(req: Request) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { title, description, projectId, priority, dueDate, startDate, status } = await req.json();
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const role = await getProjectRole(projectId, auth);
  if (!role) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await db.task.create({
    data: {
      title, description,
      userId: auth.userId,
      projectId,
      priority: (priority ?? "MEDIUM") as Priority,
      status: (status ?? "TODO") as TaskStatus,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
    include: TASK_INCLUDE,
  });

  return NextResponse.json({ task: await enrichOneTask(task) });
}
