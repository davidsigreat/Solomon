"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { formatCalendarDay, formatCalendarTime } from "@/lib/calendarDay";
import { mapCalendarClientError, type CalendarSignal } from "@/lib/calendarErrors";
import type { CalendarEvent } from "@/types";

type CalendarError = CalendarSignal | null;

function isActive(e: CalendarEvent) {
  const now = new Date();
  return new Date(e.start) <= now && new Date(e.end) >= now;
}

function isSoon(e: CalendarEvent) {
  const diff = new Date(e.start).getTime() - Date.now();
  return diff > 0 && diff < 15 * 60 * 1000;
}

const EVENT_COLORS: Record<string, string> = {
  "1": "#60a5fa", "2": "#34d399", "3": "#a78bfa", "4": "#f87171",
  "5": "#facc15", "6": "#fb923c", "7": "#38bdf8", "11": "#6ee7b7",
};

export default function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [calError, setCalError] = useState<CalendarError>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/calendar")
        .then(async (r) => {
          const d = await r.json().catch(() => ({ error: "Failed to fetch events" }));
          const mapped = mapCalendarClientError(r.status, d);
          if (mapped) {
            setCalError(mapped);
            return;
          }
          setCalError(null);
          setEvents(d.events ?? []);
        })
        .catch(() => setCalError("api_error"))
        .finally(() => setLoading(false));

    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const today = formatCalendarDay();

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0d1424]" style={{ padding: '1rem' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-[#475569] uppercase">Calendar</p>
          <p className="text-xs text-[#334155] mt-0.5">{today}</p>
        </div>
        {!calError && (
          <span className="text-[10px] text-[#475569] bg-white/[0.04] px-2 py-0.5 rounded-full">
            {events.length} events
          </span>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <div className="w-4 h-4 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
        </div>
      )}

      {/* Missing calendar scope — needs re-login */}
      {!loading && calError === "no_token" && (
        <div className="py-4 flex flex-col items-center gap-3 text-center">
          <div className="text-2xl">🔑</div>
          <div>
            <p className="text-xs font-medium text-slate-300">Calendar access not granted</p>
            <p className="text-[10px] text-[#475569] mt-1">
              Sign out and sign back in to allow SOLOMON to read your calendar.
            </p>
          </div>
          <button
            onClick={() => authClient.signOut()}
            className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-cyan-500/30 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all"
          >
            Sign out to reconnect →
          </button>
        </div>
      )}

      {!loading && calError === "unconfigured" && (
        <div className="py-6 text-center">
          <p className="text-xs text-[#475569]">Google Calendar not configured</p>
          <p className="text-[10px] text-[#334155] mt-1">Check .env.local credentials</p>
        </div>
      )}

      {!loading && calError === "api_error" && (
        <div className="py-6 text-center">
          <p className="text-xs text-red-400/70">Failed to fetch calendar</p>
          <p className="text-[10px] text-[#334155] mt-1">Check server logs for details</p>
        </div>
      )}

      {!loading && !calError && events.length === 0 && (
        <p className="text-xs text-[#334155] text-center py-6">No events today.</p>
      )}

      {!loading && !calError && events.length > 0 && (
        <div className="flex flex-col gap-2">
          {events.map((event) => {
            const color = event.colorId ? (EVENT_COLORS[event.colorId] ?? "#06b6d4") : "#06b6d4";
            const active = isActive(event);
            const soon = isSoon(event);
            return (
              <div
                key={event.id}
                className={`flex gap-3 p-2.5 rounded-xl border transition-all ${
                  active ? "border-cyan-500/20 bg-cyan-500/[0.04]"
                  : soon ? "border-amber-500/20 bg-amber-500/[0.04]"
                  : "border-white/[0.04] hover:border-white/[0.08]"
                }`}
              >
                <div className="w-0.5 rounded-full self-stretch flex-shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 justify-between">
                    <p className="text-xs font-medium text-slate-200 truncate">{event.summary}</p>
                    {active && <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0">LIVE</span>}
                    {soon && !active && <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0 animate-pulse">SOON</span>}
                  </div>
                  <p className="text-[10px] text-[#475569] mt-0.5">
                    {formatCalendarTime(event.start)}{event.start.includes("T") ? ` — ${formatCalendarTime(event.end)}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
