import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/getUser";
import { db } from "@/lib/db";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  const entries = await db.appUser.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  const { email, note, role } = await req.json();
  if (!email?.includes("@")) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const entry = await db.appUser.upsert({
    where: { email },
    update: { note, ...(role && { role }) },
    create: { email, note, role: role ?? "MEMBER" },
  });
  return NextResponse.json({ entry });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  const { email, role } = await req.json();
  const entry = await db.appUser.update({ where: { email }, data: { role } });
  return NextResponse.json({ entry });
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  const { email } = await req.json();
  await db.appUser.delete({ where: { email } });
  return NextResponse.json({ ok: true });
}
