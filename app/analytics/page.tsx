"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

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
    <div className="flex flex-col gap-5 px-4 md:px-8 py-7 max-w-[80rem] mx-auto">
      {/* stat cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl flex flex-col gap-3 p-6">
            <SkeletonBar w="55%" h="9px" />
            <SkeletonBar w="35%" h="26px" />
            <SkeletonBar w="45%" h="9px" />
          </div>
        ))}
      </div>
      {/* pipeline card */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl flex flex-col gap-5 p-6 md:p-7">
        <SkeletonBar w="30%" h="11px" />
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
    <div className="group bg-white/[0.03] backdrop-blur-sm border border-white/[0.07] hover:border-white/[0.12] rounded-2xl relative overflow-hidden transition-colors p-6">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at 25% 40%, ${c.glow}, transparent 70%)` }} aria-hidden />
      <p className="label-caps relative">{label}</p>
      <p className={`text-[2rem] font-bold tabular-nums leading-none relative mt-3 ${c.value}`}>{value}</p>
      <p className="text-[11px] text-zinc-600 mt-2.5 relative">{sub}</p>
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

      <PageHeader
        title="Analytics"
        subtitle={
          scope === "org" ? "Organization-wide task pipeline"
            : scope === "user" && targetUser ? `Viewing ${targetUser.name ?? targetUser.email ?? "user"}`
            : "Your task pipeline at a glance"
        }
        actions={isAdmin ? (
          <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/[0.06]">
            {([["own", "Mine"], ["org", "Org"], ["user", "By User"]] as const).map(([sc, label]) => (
              <button key={sc} onClick={() => { setScope(sc); if (sc !== "user") setTargetUser(null); }}
                aria-pressed={scope === sc}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                  scope === sc ? "bg-white/[0.09] text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
                }`}>{label}</button>
            ))}
          </div>
        ) : undefined}
      />

      {/* By User picker — shown when admin selects "By User" but hasn't picked yet */}
      {scope === "user" && !targetUser ? (
        <div className="flex flex-col gap-5 px-4 md:px-8 py-7 max-w-[80rem] mx-auto">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200">Select a user</h2>
            <p className="text-xs text-zinc-600 mt-1">Pick someone to see their task pipeline.</p>
          </div>
          {orgUsersLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-5 h-5 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
            </div>
          ) : orgUsers.length === 0 ? (
            <EmptyState icon="👥" title="No other users found"
              description="Once teammates sign in and appear in the org, they'll be selectable here." />
          ) : (
            <div className="fade-up grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {orgUsers.map(u => (
                <button key={u.userId} onClick={() => setTargetUser(u)}
                  className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-sm border border-white/[0.07] hover:border-white/[0.16] rounded-2xl transition-colors text-left p-4">
                  <UserAvatar u={u} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-zinc-200 truncate">{u.name ?? u.email ?? "Unknown"}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : loading ? <LoadingSkeleton /> : (
        <div className="fade-up flex flex-col gap-5 px-4 md:px-8 py-7 max-w-[80rem] mx-auto">

          {/* User scope breadcrumb — top of stats */}
          {scope === "user" && targetUser && (
            <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
              <button onClick={() => { setScope("user"); setTargetUser(null); }}
                className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors flex-shrink-0">← All users</button>
              <div className="w-px h-4 bg-white/[0.08]" aria-hidden />
              <UserAvatar u={targetUser} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-zinc-200 truncate">{targetUser.name ?? targetUser.email}</p>
                {targetUser.name && <p className="text-[10px] text-zinc-600">{targetUser.email}</p>}
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            <StatCard label="Done"        value={String(data?.tasksByStatus.DONE ?? "—")} sub="tasks completed" color="emerald" />
            <StatCard label="In Progress" value={String(data?.tasksByStatus.IN_PROGRESS ?? "—")} sub="tasks active" color="blue" />
            <StatCard label="Queued"      value={String(data?.tasksByStatus.TODO ?? "—")} sub="tasks to do" color="zinc" />
          </div>

          {/* Task pipeline */}
          <GlassCard className="p-6 md:p-7">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-sm font-semibold text-zinc-200">Task Pipeline</h2>
              <span className="text-[11px] text-zinc-600 tabular-nums">{totalTasks} total</span>
            </div>
            <div className="flex flex-col gap-4">
              {TASK_COLS.map(({ key, label, color }) => {
                const count = data?.tasksByStatus[key] ?? 0;
                const pct   = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} aria-hidden />
                        <span className="text-xs text-zinc-400">{label}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-zinc-200 tabular-nums">{count}</span>
                        <span className="text-[10px] text-zinc-600 w-8 text-right tabular-nums">{Math.round(pct)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
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
            <GlassCard>
              <EmptyState
                icon="📊"
                title="No data yet"
                description="Analytics fill in as you create and complete tasks. Start a project to see your pipeline here."
                action={
                  <Link href="/dashboard"
                    className="inline-block px-4 py-2 text-xs font-semibold text-cyan-300 border border-cyan-500/25 bg-cyan-500/10 rounded-xl hover:bg-cyan-500/20 transition-colors">
                    Go to Dashboard →
                  </Link>
                }
              />
            </GlassCard>
          )}

        </div>
      )}
    </div>
  );
}
