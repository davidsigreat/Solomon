"use client";

import { useEffect, useState, useCallback } from "react";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

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
  OVERDUE:      { label: "Overdue",      dot: "bg-red-500",    text: "text-red-400",   bg: "bg-red-500/[0.06] border-red-500/20" },
  DUE_TODAY:    { label: "Due today",    dot: "bg-amber-400",  text: "text-amber-400", bg: "bg-amber-500/[0.06] border-amber-500/20" },
  DUE_TOMORROW: { label: "Due tomorrow", dot: "bg-zinc-500",   text: "text-zinc-400",  bg: "bg-white/[0.03] border-white/[0.07]" },
};

const DISMISSED_KEY = "solomon-dismissed-notifs";
function getDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]")); } catch { return new Set(); }
}
function saveDismissed(s: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s]));
  window.dispatchEvent(new StorageEvent("storage", { key: DISMISSED_KEY }));
}

export default function NotificationsPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!isPending && !session) router.push("/login"); }, [session, isPending, router]);

  useEffect(() => {
    fetch("/api/notifications")
      .then(r => r.ok ? r.json() : { notifications: [] })
      .then(d => setNotifications(d.notifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    setDismissed(getDismissed());
  }, []);

  const dismiss = useCallback((id: string) => {
    const s = getDismissed(); s.add(id); saveDismissed(s); setDismissed(new Set(s));
  }, []);

  const dismissAll = useCallback(() => {
    const s = getDismissed();
    notifications.forEach(n => s.add(n.id));
    saveDismissed(s); setDismissed(new Set(s));
  }, [notifications]);

  if (!isPending && !session) return null;

  const groups: Record<string, Notification[]> = { OVERDUE: [], DUE_TODAY: [], DUE_TOMORROW: [] };
  for (const n of notifications) {
    if (!dismissed.has(n.id)) groups[n.type]?.push(n);
  }
  const total = Object.values(groups).flat().length;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <PageHeader
        title="Notifications"
        subtitle={total > 0 ? `${total} task${total === 1 ? "" : "s"} need attention` : "Nothing needs attention"}
        actions={total > 0 ? (
          <button onClick={dismissAll}
            className="text-xs text-zinc-500 hover:text-zinc-200 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors">
            Clear all
          </button>
        ) : undefined}
      />

      <div className="px-4 md:px-8 py-7 max-w-3xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-5 h-5 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          </div>
        ) : total === 0 ? (
          <EmptyState
            icon="✓"
            title="All caught up"
            description="No overdue or upcoming tasks. New due dates will show up here automatically."
            action={
              <Link href="/dashboard" className="inline-block text-xs font-semibold text-cyan-300 border border-cyan-500/25 bg-cyan-500/10 px-4 py-2 rounded-xl hover:bg-cyan-500/20 transition-colors">
                Back to dashboard →
              </Link>
            }
          />
        ) : (
          <div className="fade-up flex flex-col gap-7">
            {(["OVERDUE", "DUE_TODAY", "DUE_TOMORROW"] as const).map(type => {
              const group = groups[type];
              if (group.length === 0) return null;
              const meta = TYPE_META[type];
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} aria-hidden />
                    <h2 className={`text-[11px] font-bold uppercase tracking-[0.12em] ${meta.text}`}>{meta.label}</h2>
                    <span className="text-[11px] text-zinc-600 tabular-nums">{group.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {group.map(n => {
                      const due = new Date(n.dueDate);
                      return (
                        <div key={n.id} className={`group flex items-center gap-4 rounded-2xl border px-5 py-4 transition-colors ${meta.bg}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-zinc-100 truncate leading-snug">{n.title}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              {n.projectColor && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: n.projectColor }} aria-hidden />}
                              <span className="text-[11px] text-zinc-500 truncate">{n.projectName}</span>
                              <span className="text-[11px] text-zinc-700" aria-hidden>·</span>
                              <span className={`text-[11px] font-medium ${meta.text}`}>
                                {due.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => { router.push(`/dashboard`); }}
                              className="text-[11px] font-medium px-3 py-1.5 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] hover:border-white/[0.2] transition-colors whitespace-nowrap">
                              Open
                            </button>
                            <button onClick={() => dismiss(n.id)}
                              aria-label={`Dismiss ${n.title}`} title="Dismiss"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.07] transition-colors">
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
