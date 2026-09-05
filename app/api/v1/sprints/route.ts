import { NextResponse } from "next/server";
import { getApiAuth, apiAuthError, toJsonResponse } from "@/lib/apiAuth";
import { getProjectRole } from "@/lib/projectAccess";
import { logPublicSprint } from "@/lib/solomonPublic";
import { db } from "@/lib/db";
import { SprintMode } from "@prisma/client";

export async function GET(req: Request) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const mode = searchParams.get("mode");

  if (projectId) {
    const role = await getProjectRole(projectId, auth);
    if (!role) return NextResponse.json({ sprints: [] });
  }

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
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const body = await req.json();
  return toJsonResponse(await logPublicSprint(auth, body));
}
