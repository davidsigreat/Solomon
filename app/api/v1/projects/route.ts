import { NextResponse } from "next/server";
import { getApiAuth, apiAuthError, toJsonResponse } from "@/lib/apiAuth";
import { projectAccessWhere } from "@/lib/projectAccess";
import { createPublicProject } from "@/lib/solomonPublic";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const projects = await db.project.findMany({
    where: projectAccessWhere(auth),
    include: { tasks: { where: { status: { not: "DONE" } } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return apiAuthError(auth);

  const body = await req.json();
  return toJsonResponse(await createPublicProject(auth, body));
}
