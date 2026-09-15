import { NextResponse } from "next/server";
import { getAuthorizedUser, requireEditor } from "@/lib/getUser";
import { getProjectRole } from "@/lib/projectAccess";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };
type NeonUser = { id: string; name: string | null; email: string | null; image: string | null };

export async function GET(req: Request, { params }: Ctx) {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ members: [] }, { status: auth.status });
  const { id } = await params;

  const role = await getProjectRole(id, auth);
  if (!role) return NextResponse.json({ members: [] });

  try {
    const members = await db.$queryRaw<(NeonUser & { memberId: string; userId: string; role: string })[]>`
      SELECT pm.id AS "memberId", pm."userId", pm.role, u.name, u.email, u.image::text
      FROM "public"."project_members" pm
      LEFT JOIN neon_auth.user u ON u.id::text = pm."userId"
      WHERE pm."projectId" = ${id}
      ORDER BY pm."createdAt" ASC
    `;
    return NextResponse.json({ members, myRole: role });
  } catch {
    return NextResponse.json({ members: [], myRole: role });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const { id } = await params;

  const callerRole = await getProjectRole(id, auth);
  if (!callerRole) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (callerRole !== "OWNER") return NextResponse.json({ error: "Only owner can manage contributors" }, { status: 403 });

  const { email, role = "EDITOR" } = await req.json();
  if (!email?.includes("@")) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const users = await db.$queryRaw<(NeonUser & { id: string })[]>`
    SELECT id::text, name, email, image FROM neon_auth.user WHERE email = ${email} LIMIT 1
  `;
  if (users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await db.projectMember.upsert({
    where: { projectId_userId: { projectId: id, userId: users[0].id } },
    create: { projectId: id, userId: users[0].id, role },
    update: { role },
  });

  return NextResponse.json({ member: { userId: users[0].id, role, ...users[0] } });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const { id } = await params;

  const callerRole = await getProjectRole(id, auth);
  if (!callerRole || callerRole !== "OWNER")
    return NextResponse.json({ error: "Only owner can change roles" }, { status: 403 });

  const { userId, role } = await req.json();
  if (!["EDITOR", "VIEWER"].includes(role))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  await db.projectMember.update({
    where: { projectId_userId: { projectId: id, userId } },
    data: { role },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const { id } = await params;

  const callerRole = await getProjectRole(id, auth);
  if (!callerRole || callerRole !== "OWNER")
    return NextResponse.json({ error: "Only owner can remove contributors" }, { status: 403 });

  const { userId } = await req.json();
  await db.projectMember.deleteMany({ where: { projectId: id, userId } });
  return NextResponse.json({ ok: true });
}
