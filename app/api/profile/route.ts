import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/getUser";
import { db } from "@/lib/db";

export async function PATCH(req: Request) {
  const auth = await requireEditor();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { name, image } = await req.json();

  await db.$executeRaw`
    UPDATE neon_auth.user
    SET name = COALESCE(${name ?? null}::text, name),
        image = COALESCE(${image ?? null}::text, image),
        "updatedAt" = NOW()
    WHERE id = ${auth.userId}::uuid
  `;

  return NextResponse.json({ ok: true });
}
