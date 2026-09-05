import { NextResponse } from "next/server";
import { signOutAndClearCookies } from "@/lib/auth/signOut";

export const dynamic = "force-dynamic";

export async function POST() {
  await signOutAndClearCookies();
  return NextResponse.json({ ok: true });
}
