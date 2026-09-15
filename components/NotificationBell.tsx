"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

interface Notification {
  id: string;
  type: "OVERDUE" | "DUE_TODAY" | "DUE_TOMORROW";
  title: string;
  projectName: string | null;
  projectColor: string | null;
  projectId: string;
  dueDate: string;
}

const TYPE_META = {
  OVERDUE:      { label: "Overdue",    dot: "bg-red-500",    text: "text-red-400" },
  DUE_TODAY:    { label: "Due today",  dot: "bg-amber-400",  text: "text-amber-400" },
  DUE_TOMORROW: { label: "Due tomorrow", dot: "bg-zinc-500", text: "text-zinc-500" },
};

const DISMISSED_KEY = "solomon-dismissed-notifs";
const PANEL_WIDTH = 320; // px — matches w-80
const VIEWPORT_MARGIN = 8; // px — keep clear of the screen edge on narrow viewports

function getDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]")); }
  catch { return new Set(); }
}
function addDismissed(id: string) {
  const s = getDismissed(); s.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s]));
}

interface Props {
  onSelectProject: (id: string) => void;
}

export default function NotificationBell({ onSelectProject }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setDismissed(getDismissed());
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    // Sync dismissed state when notifications page updates localStorage
    function onStorage(e: StorageEvent) {
      if (e.key === DISMISSED_KEY) setDismissed(getDismissed());
    }
    window.addEventListener("storage", onStorage);
    return () => { clearInterval(id); window.removeEventListener("storage", onStorage); };
  }, [load]);

  // Position the portaled panel against the bell button — recomputed whenever
  // it opens and on resize, so it tracks the trigger instead of being clipped
  // by an overflow-hidden ancestor (the dashboard shell is overflow-hidden
  // top to bottom for its own scroll regions).
  const updatePosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const maxRight = Math.max(window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN, VIEWPORT_MARGIN);
    const right = Math.min(Math.max(window.innerWidth - r.right, VIEWPORT_MARGIN), maxRight);
    setPos({ top: r.bottom + 8, right });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [open, updatePosition]);

  // Close on outside click — the panel is portaled to <body>, so it's no
  // longer a DOM descendant of the trigger; check both refs.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const visible = notifications.filter(n => !dismissed.has(n.id));
  const urgent  = visible.filter(n => n.type === "OVERDUE" || n.type === "DUE_TODAY");

  function dismiss(id: string) {
    addDismissed(id);
    setDismissed(getDismissed());
  }

  function dismissAll() {
    visible.forEach(n => addDismissed(n.id));
    setDismissed(getDismissed());
    setOpen(false);
  }

  function handleGoTo(n: Notification) {
    onSelectProject(n.projectId);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        title="Notifications"
        aria-label={urgent.length > 0 ? `Notifications (${urgent.length} urgent)` : "Notifications"}
        aria-expanded={open}
        className={`relative w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
          open ? "bg-white/[0.08] text-zinc-100" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06]"
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M7.5 1.5C5.015 1.5 3 3.515 3 6v3.5L1.5 11h12L12 9.5V6c0-2.485-2.015-4.5-4.5-4.5Z"
            stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          <path d="M6 11.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        {urgent.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-red-500 ring-2 ring-[#0b0b0f] text-[9px] font-bold text-white flex items-center justify-center leading-none tabular-nums">
            {urgent.length > 9 ? "9+" : urgent.length}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
          className="pop-in w-80 max-w-[calc(100vw-1rem)] bg-[#111116] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="flex items-baseline gap-1.5">
              <span className="text-xs font-semibold text-zinc-200">Notifications</span>
              {visible.length > 0 && <span className="text-[10px] text-zinc-600 tabular-nums">{visible.length}</span>}
            </span>
            {visible.length > 0 && (
              <button onClick={dismissAll} className="text-[10px] text-zinc-500 hover:text-zinc-200 transition-colors">
                Clear all
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
              <span className="w-9 h-9 rounded-xl bg-white/[0.035] border border-white/[0.07] flex items-center justify-center text-sm text-zinc-500">✓</span>
              <p className="text-xs font-medium text-zinc-300">All caught up</p>
              <p className="text-[10px] text-zinc-600">No tasks due soon</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {visible.map(n => {
                const meta = TYPE_META[n.type];
                const due = new Date(n.dueDate);
                const dateLabel = due.toLocaleDateString("en", { month: "short", day: "numeric" });
                return (
                  <div key={n.id} className="group flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${meta.dot}`} aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-200 truncate leading-snug">{n.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {n.projectColor && (
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: n.projectColor }} />
                        )}
                        {n.projectName && <span className="text-[10px] text-zinc-600 truncate">{n.projectName}</span>}
                        <span className={`text-[10px] font-medium ${meta.text}`}>{meta.label} · {dateLabel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleGoTo(n)} aria-label={`Open ${n.title}`} title="Open project"
                        className="w-6 h-6 flex items-center justify-center rounded-md text-xs text-zinc-500 hover:text-cyan-300 hover:bg-white/[0.06] transition-colors">→</button>
                      <button onClick={() => dismiss(n.id)} aria-label={`Dismiss ${n.title}`} title="Dismiss"
                        className="w-6 h-6 flex items-center justify-center rounded-md text-xs text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors">×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.015]">
            <a href="/notifications" onClick={() => setOpen(false)}
              className="text-[11px] text-zinc-500 hover:text-cyan-300 transition-colors w-full text-center block py-0.5">
              View all notifications →
            </a>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
