import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/getUser";
import { db } from "@/lib/db";
import { google } from "googleapis";
import { getCalendarDayWindow } from "@/lib/calendarDay";

async function getCalendarClient(userId: string, isAdmin: boolean) {
  const rows = await db.$queryRaw<{
    accessToken: string | null;
    refreshToken: string | null;
    scope: string | null;
  }[]>`
    SELECT "accessToken", "refreshToken", "scope"
    FROM neon_auth.account
    WHERE "userId"::text = ${userId}
      AND "providerId" = 'google'
    LIMIT 1
  `;

  const account = rows[0];

  if (account?.refreshToken) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    client.setCredentials({
      refresh_token: account.refreshToken,
      access_token: account.accessToken ?? undefined,
    });
    return google.calendar({ version: "v3", auth: client });
  }

  if (isAdmin && process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    client.setCredentials({ refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN });
    return google.calendar({ version: "v3", auth: client });
  }

  return null;
}

function isReconnectError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /invalid_grant|insufficient|scope|invalid.?credentials/i.test(message);
}

export async function GET() {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized", events: [] }, { status: auth.status });

  try {
    const calendar = await getCalendarClient(auth.userId, auth.isAdmin);

    if (!calendar) {
      return NextResponse.json({ error: "No calendar access token", events: [] }, { status: 200 });
    }

    const { timeMin, timeMax, timeZone } = getCalendarDayWindow();

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      timeZone,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = (res.data.items ?? []).map((e) => ({
      id: e.id ?? "",
      summary: e.summary ?? "Untitled Event",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      location: e.location,
      colorId: e.colorId,
    }));

    return NextResponse.json({ events });
  } catch (err) {
    if (isReconnectError(err)) {
      return NextResponse.json({ error: "No calendar access token", events: [] }, { status: 200 });
    }
    console.error("Calendar error:", err instanceof Error ? err.message : "google_error");
    return NextResponse.json({ error: "Failed to fetch events", events: [] }, { status: 500 });
  }
}
