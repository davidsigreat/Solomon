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

type CalendarCode = "no_token" | "unconfigured" | "api_error";

function fail(code: CalendarCode, error: string, status: number) {
  return NextResponse.json({ error, code, events: [] }, { status });
}

function googleClientConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

function classifyGoogleError(err: unknown): CalendarCode {
  const message = err instanceof Error ? err.message : String(err);
  if (/invalid_client|unauthorized_client|client.?id|client.?secret/i.test(message)) return "unconfigured";
  if (/invalid_grant|insufficient|scope|invalid.?credentials/i.test(message)) return "no_token";
  return "api_error";
}

export async function GET() {
  const auth = await getAuthorizedUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized", events: [] }, { status: auth.status });

  try {
    const calendar = await getCalendarClient(auth.userId, auth.isAdmin);

    if (!calendar) {
      return fail("no_token", "No calendar access token", 200);
    }

    if (!googleClientConfigured()) {
      return fail("unconfigured", "Google Calendar not configured", 503);
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
    const code = classifyGoogleError(err);
    console.error("Calendar error:", code);
    if (code === "no_token") return fail("no_token", "No calendar access token", 200);
    if (code === "unconfigured") return fail("unconfigured", "Google Calendar not configured", 503);
    return fail("api_error", "Failed to fetch events", 500);
  }
}
