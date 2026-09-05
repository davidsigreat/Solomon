import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/getUser";
import { db } from "@/lib/db";
import { getOwnedSession, serializeMessage } from "@/lib/chat";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const session = await db.session.findFirst({
    where: { id, userId: auth.userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    session: {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messageCount: session.messages.length,
    },
    messages: session.messages.map(serializeMessage),
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const owned = await getOwnedSession(id, auth.userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { title } = await req.json();
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const session = await db.session.update({
    where: { id },
    data: { title: title.trim().slice(0, 80) },
  });

  return NextResponse.json({
    session: {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const owned = await getOwnedSession(id, auth.userId);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.session.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
