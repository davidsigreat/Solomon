import { NextResponse } from "next/server";
import { getApiAuth, requireApiEditor } from "@/lib/apiAuth";
import { getProjectRole } from "@/lib/projectAccess";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await getApiAuth(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const role = await getProjectRole(id, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await db.project.findUnique({ where: { id }, include: { tasks: true } });
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireApiEditor(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const role = await getProjectRole(id, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const project = await db.project.update({
    where: { id },
    data: {
      ...(body.name !== undefined        && { name: body.name }),
      ...(body.color !== undefined       && { color: body.color }),
      ...(body.description !== undefined && { description: body.description }),
    },
  });
  return NextResponse.json({ project });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireApiEditor(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const role = await getProjectRole(id, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role !== "OWNER") return NextResponse.json({ error: "Only owner can delete" }, { status: 403 });

  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
