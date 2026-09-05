import "server-only";
import { Priority, SprintMode, TaskStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { AuthedUser, PublicResult } from "@/lib/apiAuth";
import { enrichAssignees, enrichOneTask } from "@/lib/enrichAssignees";
import { getProjectRole, projectAccessWhere, requireProjectMutate } from "@/lib/projectAccess";

const OPEN_TASK_SAMPLE_LIMIT = 5;
const DEFAULT_PROJECT_COLOR = "#06b6d4";

export const TASK_INCLUDE = {
  project: true,
  subtasks: { orderBy: { createdAt: "asc" as const } },
  assignees: true,
};

export type TaskCounts = {
  TODO: number;
  IN_PROGRESS: number;
  IN_REVIEW: number;
  DONE: number;
};

export type OpenTaskSample = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
};

export type PortfolioProject = {
  id: string;
  name: string;
  color: string;
  taskCounts: TaskCounts;
  overdueCount: number;
  openTasks: OpenTaskSample[];
};

export type PortfolioStatus = { projects: PortfolioProject[] };

export type UpsertTaskInput = {
  id?: string;
  title?: string;
  description?: string;
  projectId?: string;
  priority?: string;
  status?: string;
  startDate?: string | null;
  dueDate?: string | null;
};

export type LogSprintInput = {
  taskName?: string;
  projectId?: string | null;
  duration?: number;
  mode?: string;
  completed?: boolean;
};

function emptyTaskCounts(): TaskCounts {
  return { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
}

/** Cross-project overview for every project the key can access. */
export async function getPortfolioStatus(
  auth: AuthedUser,
  projectId?: string,
): Promise<PortfolioStatus> {
  const projects = await db.project.findMany({
    where: {
      ...projectAccessWhere(auth),
      ...(projectId ? { id: projectId } : {}),
    },
    select: {
      id: true,
      name: true,
      color: true,
      tasks: {
        select: { id: true, title: true, status: true, dueDate: true },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  return {
    projects: projects.map((project) => {
      const taskCounts = emptyTaskCounts();
      let overdueCount = 0;
      const openTasks: OpenTaskSample[] = [];

      for (const task of project.tasks) {
        taskCounts[task.status] += 1;
        const isOpen = task.status !== "DONE";
        if (isOpen && task.dueDate && task.dueDate < now) overdueCount += 1;
        if (isOpen && openTasks.length < OPEN_TASK_SAMPLE_LIMIT) {
          openTasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            dueDate: task.dueDate?.toISOString() ?? null,
          });
        }
      }

      return {
        id: project.id,
        name: project.name,
        color: project.color,
        taskCounts,
        overdueCount,
        openTasks,
      };
    }),
  };
}

export async function listAccessibleProjects(auth: AuthedUser) {
  const projects = await db.project.findMany({
    where: projectAccessWhere(auth),
    select: {
      id: true,
      name: true,
      color: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return { projects };
}

export async function createPublicProject(
  auth: AuthedUser,
  input: { name?: string; color?: string; description?: string },
): Promise<PublicResult<{ project: unknown }>> {
  if (!auth.canEdit) return { ok: false, status: 403, error: "Forbidden" };
  if (!input.name?.trim()) return { ok: false, status: 400, error: "name is required" };

  const project = await db.project.create({
    data: {
      name: input.name.trim(),
      color: input.color ?? DEFAULT_PROJECT_COLOR,
      description: input.description,
      userId: auth.userId,
    },
  });
  return { ok: true, status: 201, data: { project } };
}

export async function listPublicTasks(
  auth: AuthedUser,
  filters: { projectId?: string | null; status?: string | null },
): Promise<PublicResult<{ tasks: unknown }>> {
  if (filters.projectId) {
    const role = await getProjectRole(filters.projectId, auth);
    if (!role) return { ok: true, data: { tasks: [] } };
  }

  const tasks = await db.task.findMany({
    where: {
      ...(filters.projectId
        ? { projectId: filters.projectId }
        : { project: projectAccessWhere(auth) }),
      ...(filters.status ? { status: filters.status as TaskStatus } : {}),
    },
    include: TASK_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return { ok: true, data: { tasks: await enrichAssignees(tasks) } };
}

export async function upsertPublicTask(
  auth: AuthedUser,
  input: UpsertTaskInput,
): Promise<PublicResult<{ task: unknown }>> {
  if (!auth.canEdit) return { ok: false, status: 403, error: "Forbidden" };

  if (input.id) {
    const existing = await db.task.findUnique({
      where: { id: input.id },
      select: { projectId: true },
    });
    if (!existing) return { ok: false, status: 404, error: "Not found" };

    const access = await requireProjectMutate(existing.projectId, auth);
    if (!access.ok) return access;

    if (input.projectId && input.projectId !== existing.projectId) {
      const dest = await requireProjectMutate(input.projectId, auth);
      if (!dest.ok) return dest;
    }

    const task = await db.task.update({
      where: { id: input.id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.status !== undefined && { status: input.status as TaskStatus }),
        ...(input.priority !== undefined && { priority: input.priority as Priority }),
        ...(input.projectId && { projectId: input.projectId }),
        ...(input.startDate !== undefined && {
          startDate: input.startDate ? new Date(input.startDate) : null,
        }),
        ...(input.dueDate !== undefined && {
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        }),
      },
      include: TASK_INCLUDE,
    });
    return { ok: true, data: { task: await enrichOneTask(task) } };
  }

  if (!input.title?.trim()) return { ok: false, status: 400, error: "title is required" };
  if (!input.projectId) return { ok: false, status: 400, error: "projectId is required" };

  const access = await requireProjectMutate(input.projectId, auth);
  if (!access.ok) {
    return {
      ok: false,
      status: access.status,
      error: access.status === 404 ? "Project not found" : access.error,
    };
  }

  const task = await db.task.create({
    data: {
      title: input.title,
      description: input.description,
      userId: auth.userId,
      projectId: input.projectId,
      priority: (input.priority ?? "MEDIUM") as Priority,
      status: (input.status ?? "TODO") as TaskStatus,
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
    include: TASK_INCLUDE,
  });
  return { ok: true, status: 201, data: { task: await enrichOneTask(task) } };
}

export async function logPublicSprint(
  auth: AuthedUser,
  input: LogSprintInput,
): Promise<PublicResult<{ sprint: unknown }>> {
  if (!auth.canEdit) return { ok: false, status: 403, error: "Forbidden" };
  if (!input.duration) return { ok: false, status: 400, error: "duration is required" };

  if (input.projectId) {
    const access = await requireProjectMutate(input.projectId, auth);
    if (!access.ok) return access;
  }

  const sprint = await db.sprintSession.create({
    data: {
      taskName: input.taskName || null,
      projectId: input.projectId || null,
      duration: input.duration,
      mode: (input.mode ?? "FOCUS") as SprintMode,
      completed: input.completed ?? true,
      userId: auth.userId,
    },
  });
  return { ok: true, status: 201, data: { sprint } };
}
