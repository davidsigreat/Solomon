import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/getUser";
import { db } from "@/lib/db";
import { google } from "googleapis";
import { getCalendarDayWindow } from "@/lib/calendarDay";
import {
  classifyCalendarFailure,
  googleClientConfigured,
  hasCalendarScope,
} from "@/lib/calendarErrors";

type AccountRow = {
  accessToken: string | null;
  refreshToken: string | null;
  scope: string | null;
};

type CalendarPayload = {
  events: unknown[];
  error?: string;
  code?: string;
  reason?: string;
};

function json(body: CalendarPayload, status = 200) {
  return NextResponse.json(body, { status });
}

async function loadGoogleAccount(userId: string): Promise<AccountRow | null> {
  const rows = await db.$queryRaw<AccountRow[]>`
    SELECT "accessToken", "refreshToken", "scope"
    FROM neon_auth.account
    WHERE "userId"::text = ${userId}
      AND "providerId" = 'google'
    LIMIT 1
  `;
  return rows[0] ?? null;
}

function createCalendarClient(refreshToken: string | null, accessToken: string | null) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
    ...(accessToken ? { access_token: accessToken } : {}),
  });
  return google.calendar({ version: "v3", auth: client });
}

export async function GET() {
  const auth = await getAuthorizedUser();
  if (!auth.ok) {
    return json({ error: "Unauthorized", events: [] }, auth.status);
  }

  try {
    const account = await loadGoogleAccount(auth.userId);
    const refreshToken =
      account?.refreshToken ??
      (auth.isAdmin ? process.env.GOOGLE_CALENDAR_REFRESH_TOKEN ?? null : null);
    const accessToken = account?.accessToken ?? null;

    if (!refreshToken && !accessToken) {
      return json({ error: "No calendar access token", code: "no_token", reason: "missing_refresh_token", events: [] });
    }

    // Scope persisted and not calendar → reconnect. Null scope still tries Google.
    if (account?.scope && !hasCalendarScope(account.scope)) {
      return json({ error: "No calendar access token", code: "no_token", reason: "insufficient_scope", events: [] });
    }

    if (!accessToken && !googleClientConfigured()) {
      return json({ error: "Google Calendar not configured", code: "unconfigured", reason: "missing_client", events: [] }, 503);
    }

    const calendar = createCalendarClient(refreshToken, accessToken);
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

    return json({ events });
  } catch (err) {
    const classified = classifyCalendarFailure(err);
    console.error("Calendar error:", classified.reason);
    return json(
      { error: classified.error, code: classified.code, reason: classified.reason, events: [] },
      classified.status
    );
  }
}
