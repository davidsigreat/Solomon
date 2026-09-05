/**
 * Calendar "today" is always Pacific/Honolulu.
 * Vercel API routes run in UTC; Date#setHours(0/23) there is the wrong civil
 * day for Honolulu (UTC-10, no DST).
 */
export const CALENDAR_TIMEZONE = "Pacific/Honolulu";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function readZonedParts(date: Date, timeZone: string): ZonedParts {
  const map = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const hour = Number(map.hour);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** UTC millis for a wall-clock time in `timeZone`. */
function zonedWallTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string
): number {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const shown = readZonedParts(new Date(utcGuess), timeZone);
  const shownAsUtc = Date.UTC(
    shown.year,
    shown.month - 1,
    shown.day,
    shown.hour,
    shown.minute,
    shown.second,
    millisecond
  );
  return utcGuess - (shownAsUtc - utcGuess);
}

export function getCalendarDayWindow(
  now: Date = new Date(),
  timeZone: string = CALENDAR_TIMEZONE
): { timeMin: string; timeMax: string; timeZone: string } {
  const { year, month, day } = readZonedParts(now, timeZone);
  const timeMinMs = zonedWallTimeToUtcMs(year, month, day, 0, 0, 0, 0, timeZone);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const timeMaxMs = zonedWallTimeToUtcMs(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
    0,
    0,
    timeZone
  );

  return {
    timeMin: new Date(timeMinMs).toISOString(),
    timeMax: new Date(timeMaxMs).toISOString(),
    timeZone,
  };
}

export function formatCalendarDay(
  now: Date = new Date(),
  timeZone: string = CALENDAR_TIMEZONE
): string {
  return now.toLocaleDateString("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  });
}

export function formatCalendarTime(
  iso: string,
  timeZone: string = CALENDAR_TIMEZONE
): string {
  if (!iso.includes("T")) return "All day";
  return new Date(iso).toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });
}
