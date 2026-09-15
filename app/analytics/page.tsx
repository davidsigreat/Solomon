"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserStat {
  userId: string; name: string | null; email: string | null; image: string | null;
}
interface AnalyticsData {
  tasksByStatus: { TODO: number; IN_PROGRESS: number; IN_REVIEW: number; DONE: number };
  userBreakdown: UserStat[];
}

function UserAvatar({ u }: { u: Pick<UserStat, "name" | "email" | "image"> }) {
  const label = u.name ?? u.email ?? "?";
  const initials = label.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  return u.image
    ? <img src={u.image} alt={label} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
    : <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
        style={{ background: "linear-gradient(135deg,rgba(6,182,212,0.5),rgba(139,92,246,0.5))" }}>{initials}</div>;
}

function GlassCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`bg-white/[0.03] backdrop-blur-sm border border-white/[0.07] rounded-2xl ${className}`} style={style}>
      {children}
    </div>
  );
}

function SkeletonBar({ w = "100%", h = "12px" }: { w?: string; h?: string }) {
  return (
    <div className="skeleton rounded-full overflow-hidden" style={{ width: w, height: h }} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col" style={{ padding: '2rem 3rem', gap: '1.5rem' }}>
      {/* stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl flex flex-col gap-3" style={{ padding: '1.75rem' }}>
            <SkeletonBar w="60%" h="10px" />
            <SkeletonBar w="40%" h="28px" />
            <SkeletonBar w="50%" h="10px" />
          </div>
        ))}
      </div>
      {/* pipeline card */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl flex flex-col gap-4" style={{ padding: '2rem 2.25rem' }}>
        <SkeletonBar w="40%" h="12px" />
        {[...Array(4)].map((_, j) => <SkeletonBar key={j} h="8px" />)}
      </div>
    </div>
  );
}

const TASK_COLS = [
  { key: "TODO",        label: "To Do",       color: "#71717a" },
  { key: "IN_PROGRESS", label: "In Progress",  color: "#60a5fa" },
  { key: "IN_REVIEW",   label: "In Review",    color: "#a78bfa" },
  { key: "DONE",        label: "Done",         color: "#34d399" },
] as const;

const STAT_COLORS: Record<string, { value: string; glow: string }> = {
  emerald: { value: "text-emerald-400", glow: "rgba(52,211,153,0.15)" },
  blue:    { value: "text-blue-400",    glow: "rgba(96,165,250,0.15)" },
  zinc:    { value: "text-zinc-300",    glow: "rgba(255,255,255,0.05)" },
};

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: keyof typeof STAT_COLORS }) {
  const c = STAT_COLORS[color];
  return (
    <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.07] rounded-2xl relative"
      style={{ padding: '1.75rem 1.75rem' }}>
      <div className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{ background: `radial-gradient(circle at 30% 50%, ${c.glow}, transparent 70%)` }} />
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 relative">{label}</p>
      <p className={`text-3xl font-bold tabular-nums leading-none relative ${c.value}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-3 relative">{sub}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [data, setData]         = useState<AnalyticsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [isAdmin, setIsAdmin]           = useState(false);
  const [scope, setScope]               = useState<"own" | "org" | "user">("own");
  const [targetUser, setTargetUser]     = useState<UserStat | null>(null);
  const [orgUsers, setOrgUsers]         = useState<UserStat[]>([]);
  const [orgUsersLoading, setOrgUsersLoading] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.push("/login");
  }, [session, isPending, router]);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : { isAdmin: false }).then((d: { isAdmin?: boolean }) => setIsAdmin(!!d.isAdmin)).catch(() => {});
  }, []);

  // Load org user list when admin enters "By User" or "Organization"
  useEffect(() => {
    if (!isAdmin) return;
    if (scope !== "user" && scope !== "org") return;
    if (orgUsers.length > 0) return;
    setOrgUsersLoading(true);
    fetch(`/api/analytics?scope=org`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setOrgUsers(d?.userBreakdown ?? []); })
      .catch(() => { setOrgUsers([]); })
      .finally(() => setOrgUsersLoading(false));
  }, [scope, isAdmin, orgUsers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Don't fetch stats when picking a user — show picker instead
    if (scope === "user" && !targetUser) { setLoading(false); setData(null); return; }
    setLoading(true); setData(null);
    const params = new URLSearchParams();
    if (scope === "org") params.set("scope", "org");
    if (scope === "user" && targetUser) params.set("userId", targetUser.userId);
    fetch(`/api/analytics?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [scope, targetUser]);

  if (!isPending && !session) return null;

  const totalTasks = data ? Object.values(data.tasksByStatus).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-4 px-4 md:px-8 py-3.5 border-b border-white/[0.05] bg-[#09090b]/80 backdrop-blur-md">
        <Link href="/dashboard"
          className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Dashboard
        </Link>
        <div className="w-px h-4 bg-white/[0.08]" />
        <h1 className="text-sm font-semibold text-zinc-100 flex-1">Analytics</h1>

        {/* Admin scope selector */}
        {isAdmin && (
          <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06]">
            {([["own", "My Stats"], ["org", "Organization"], ["user", "By User"]] as const).map(([s, label]) => (
              <button key={s} onClick={() => { setScope(s); if (s !== "user") setTargetUser(null); }}
                className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                  scope === s ? "bg-white/[0.08] text-zinc-100" : "text-zinc-600 hover:text-zinc-400"
                }`}>{label}</button>
            ))}
          </div>
        )}
      </header>

      {/* By User picker — shown when admin selects "By User" but hasn't picked yet */}
      {scope === "user" && !targetUser ? (
        <div className="flex flex-col" style={{ padding: '2rem 3rem', gap: '1.5rem' }}>
          <p className="text-sm font-semibold text-zinc-300">Select a user to view their stats</p>
          {orgUsersLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-5 h-5 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
            </div>
          ) : orgUsers.length === 0 ? (
            <p className="text-sm text-zinc-600">No other users found.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {orgUsers.map(u => (
                <button key={u.userId} onClick={() => setTargetUser(u)}
                  className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.07] backdrop-blur-sm border border-white/[0.07] hover:border-white/[0.16] rounded-2xl transition-all text-left"
                  style={{ padding: '1rem' }}>
                  <UserAvatar u={u} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{u.name ?? u.email ?? "Unknown"}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : loading ? <LoadingSkeleton /> : (
        <div className="flex flex-col" style={{ padding: '2rem 3rem', gap: '1.5rem' }}>

          {/* User scope breadcrumb — top of stats */}
          {scope === "user" && targetUser && (
            <div className="flex items-center gap-3 pb-2 border-b border-white/[0.06]">
              <button onClick={() => { setScope("user"); setTargetUser(null); }}
                className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0">← All users</button>
              <div className="w-px h-4 bg-white/[0.08]" />
              <UserAvatar u={targetUser} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{targetUser.name ?? targetUser.email}</p>
                {targetUser.name && <p className="text-[10px] text-zinc-600">{targetUser.email}</p>}
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <StatCard label="Done"        value={String(data?.tasksByStatus.DONE ?? "—")} sub="tasks completed" color="emerald" />
            <StatCard label="In Progress" value={String(data?.tasksByStatus.IN_PROGRESS ?? "—")} sub="tasks active" color="blue" />
            <StatCard label="Queued"      value={String(data?.tasksByStatus.TODO ?? "—")} sub="tasks to do" color="zinc" />
          </div>

          {/* Task pipeline */}
          <GlassCard style={{ padding: '2rem 2.25rem' }}>
            <p className="text-sm font-semibold text-zinc-200 mb-6">Task Pipeline</p>
            <div className="flex flex-col gap-4">
              {TASK_COLS.map(({ key, label, color }) => {
                const count = data?.tasksByStatus[key] ?? 0;
                const pct   = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-zinc-400">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-200">{count}</span>
                        <span className="text-[10px] text-zinc-600 w-8 text-right">{Math.round(pct)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color,
                          boxShadow: `0 0 8px ${color}60` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Empty state when zero data */}
          {data && totalTasks === 0 && scope === "own" && (
            <GlassCard className="p-10">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl">📊</div>
                <p className="text-sm text-zinc-400 font-medium">No data yet</p>
                <p className="text-xs text-zinc-600 max-w-xs">Create tasks to start populating your analytics.</p>
                <Link href="/dashboard"
                  className="mt-2 px-4 py-2 text-xs font-semibold text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 rounded-xl hover:bg-cyan-500/20 transition-all">
                  Go to Dashboard →
                </Link>
              </div>
            </GlassCard>
          )}

        </div>
      )}
    </div>
  );
}
