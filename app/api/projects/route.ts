import { NextResponse } from "next/server";
import { getAuthorizedUser, requireEditor } from "@/lib/getUser";
import { projectAccessWhere } from "@/lib/projectAccess";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ projects: [] }, { status: auth.status });

  const projects = await db.project.findMany({
    where: projectAccessWhere(auth),
    include: { tasks: { where: { status: { not: "DONE" } } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { name, color, description } = await req.json();
  const project = await db.project.create({
    data: { name, color: color ?? "#06b6d4", description, userId: auth.userId },
  });

  return NextResponse.json({ project });
}
