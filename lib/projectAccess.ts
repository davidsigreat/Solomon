import { db } from "@/lib/db";

export type ProjectRole = "OWNER" | "EDITOR" | "VIEWER";

/**
 * Returns the effective role of `auth` on `projectId`, or null if no access.
 * Admin always gets OWNER-level access.
 * Project creator (project.userId) is always OWNER.
 */
export async function getProjectRole(
  projectId: string,
  auth: { userId: string; isAdmin: boolean }
): Promise<ProjectRole | null> {
  if (auth.isAdmin) return "OWNER";

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) return null;
  if (project.userId === auth.userId) return "OWNER";

  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: auth.userId } },
    select: { role: true },
  });
  if (!member) return null;
  return member.role as ProjectRole;
}

/** Accessible-project WHERE clause for Prisma queries. */
export function projectAccessWhere(auth: { userId: string; isAdmin: boolean }) {
  if (auth.isAdmin) return {};
  return {
    OR: [
      { userId: auth.userId },
      { members: { some: { userId: auth.userId } } },
    ],
  };
}

/** Task's project + caller's role on it. `task` is null when the task doesn't exist. */
export async function resolveTaskAccess(
  taskId: string,
  auth: { userId: string; isAdmin: boolean }
): Promise<{ task: { projectId: string } | null; role: ProjectRole | null }> {
  const task = await db.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) return { task: null, role: null };
  return { task, role: await getProjectRole(task.projectId, auth) };
}
