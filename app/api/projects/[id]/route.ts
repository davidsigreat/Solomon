import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/getUser";
import { getProjectRole } from "@/lib/projectAccess";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const role = await getProjectRole(id, auth);
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role !== "OWNER") return NextResponse.json({ error: "Only owner can delete" }, { status: 403 });

  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
