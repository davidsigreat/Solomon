export type CalendarSignal = "no_token" | "unconfigured" | "api_error";

export type CalendarErrorBody = {
  error?: string;
  code?: string;
  reason?: string;
};

const CALENDAR_SCOPES = new Set([
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.events.readonly",
]);

export function googleClientConfigured(
  clientId = process.env.GOOGLE_CLIENT_ID,
  clientSecret = process.env.GOOGLE_CLIENT_SECRET
): boolean {
  return Boolean(clientId?.trim() && clientSecret?.trim());
}

/** True only when Google persisted a scope string that includes calendar. */
export function hasCalendarScope(scope: string | null | undefined): boolean {
  if (!scope?.trim()) return false;
  return scope.split(/[\s,]+/).some((part) => CALENDAR_SCOPES.has(part));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

/** Safe short code only — never tokens, secrets, or raw Google payloads. */
export function extractGoogleReason(err: unknown): string {
  const obj = asRecord(err);
  const response = asRecord(obj?.response);
  const data = asRecord(response?.data);
  const dataError = data?.error;
  const nested = asRecord(dataError);
  const firstError = Array.isArray(nested?.errors) ? asRecord(nested.errors[0]) : null;

  const raw = readString(
    typeof dataError === "string" ? dataError : "",
    nested?.status,
    firstError?.reason,
    obj?.code,
    obj?.message
  ).toLowerCase();

  return normalizeReason(raw);
}

export function normalizeReason(raw: string): string {
  const text = raw.slice(0, 160);
  if (/column|neon_auth\.account|does not exist|relation/.test(text)) return "account_lookup";
  if (/invalid_grant|invalid.?credentials|token.?expired/.test(text)) return "invalid_grant";
  if (/insufficient|scope|permission_denied|access_denied/.test(text)) return "insufficient_scope";
  if (/invalid_client|unauthorized_client|could not determine client|missing.?client/.test(text)) {
    return "missing_client";
  }
  if (/invalid_request/.test(text) && /client/.test(text)) return "missing_client";
  if (/rate.?limit|quota/.test(text)) return "rate_limited";
  if (/not.?found/.test(text)) return "not_found";
  const token = text.match(/\b[a-z][a-z0-9_]{1,31}\b/);
  return token?.[0] ?? "google_error";
}

export function classifyCalendarFailure(err: unknown): {
  code: CalendarSignal;
  error: string;
  reason: string;
  status: number;
} {
  const reason = extractGoogleReason(err);
  if (reason === "missing_client") {
    return { code: "unconfigured", error: "Google Calendar not configured", reason, status: 503 };
  }
  if (reason === "invalid_grant" || reason === "insufficient_scope") {
    return { code: "no_token", error: "No calendar access token", reason, status: 200 };
  }
  return { code: "api_error", error: "Failed to fetch events", reason, status: 502 };
}

/** Widget mapping — never fold Unauthorized / no_token into opaque api_error. */
export function mapCalendarClientError(
  status: number,
  body: CalendarErrorBody
): CalendarSignal | null {
  if (body.code === "no_token" || body.code === "unconfigured" || body.code === "api_error") {
    return body.code;
  }
  if (status === 401 || body.error === "Unauthorized" || body.error === "No calendar access token") {
    return "no_token";
  }
  if (body.error === "Google Calendar not configured") return "unconfigured";
  if (body.error) return "api_error";
  return null;
}
