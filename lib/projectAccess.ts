import { db } from "@/lib/db";
import type { AuthedUser } from "@/lib/getUser";

export type ProjectRole = "OWNER" | "EDITOR" | "VIEWER";

export type MutateAccess =
  | { ok: true; role: ProjectRole }
  | { ok: false; status: 403 | 404; error: string };

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

/**
 * App-level VIEWER is always read-only. Otherwise the project role must be
 * EDITOR or OWNER (creator / admin count as OWNER).
 */
export async function requireProjectMutate(
  projectId: string,
  auth: AuthedUser,
): Promise<MutateAccess> {
  if (!auth.canEdit) return { ok: false, status: 403, error: "Forbidden" };
  const role = await getProjectRole(projectId, auth);
  if (!role) return { ok: false, status: 404, error: "Not found" };
  if (role === "VIEWER") return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true, role };
}
