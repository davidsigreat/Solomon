import { NextResponse } from "next/server";
import { requireApiEditor } from "@/lib/apiAuth";
import { getProjectRole } from "@/lib/projectAccess";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireApiEditor(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id, userId } = await params;
  const callerRole = await getProjectRole(id, auth);
  if (!callerRole || callerRole !== "OWNER")
    return NextResponse.json({ error: "Only owner can change roles" }, { status: 403 });

  const { role } = await req.json();
  if (!["EDITOR", "VIEWER"].includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  await db.projectMember.update({ where: { projectId_userId: { projectId: id, userId } }, data: { role } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireApiEditor(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id, userId } = await params;
  const callerRole = await getProjectRole(id, auth);
  if (!callerRole || callerRole !== "OWNER")
    return NextResponse.json({ error: "Only owner can remove contributors" }, { status: 403 });

  await db.projectMember.deleteMany({ where: { projectId: id, userId } });
  return NextResponse.json({ ok: true });
}
