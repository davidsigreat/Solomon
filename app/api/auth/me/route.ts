import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/getUser";

export async function GET() {
  const result = await getAuthorizedUser();
  if (!result.ok) {
    return NextResponse.json(
      { isAdmin: false, error: result.error, reason: result.reason },
      { status: result.status },
    );
  }
  return NextResponse.json({ isAdmin: result.isAdmin, canEdit: result.canEdit, role: result.role, userId: result.userId, email: result.email });
}
