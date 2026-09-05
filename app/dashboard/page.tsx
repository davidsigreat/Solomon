"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import CalendarWidget from "@/components/CalendarWidget";
import ChronoMatrix from "@/components/sprint/ChronoMatrix";
import KanbanBoard from "@/components/KanbanBoard";
import dynamic from "next/dynamic";
const ProfileModal = dynamic(() => import("@/components/profile/ProfileModal"), { ssr: false });
import NotificationBell from "@/components/NotificationBell";
import type { Project } from "@/types";

function Clock() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!time) return <div className="w-28 h-8" />;
  return (
    <div className="text-right tabular-nums">
      <p className="text-base font-mono font-bold text-zinc-100 leading-none">
        {time.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
      </p>
      <p className="text-[10px] text-zinc-600 mt-1">
        {time.toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}
      </p>
    </div>
  );
}

function CollapseButton({ collapsed, onClick, side }: { collapsed: boolean; onClick: () => void; side: "left" | "right" }) {
  const arrow = side === "left" ? (collapsed ? "›" : "‹") : (collapsed ? "‹" : "›");
  return (
    <button
      onClick={onClick}
      title={collapsed ? "Expand" : "Collapse"}
      className="w-5 h-8 flex items-center justify-center text-zinc-700 hover:text-zinc-300 hover:bg-white/[0.05] rounded transition-all text-sm flex-shrink-0"
    >
      {arrow}
    </button>
  );
}

export default function DashboardPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [projects, setProjects]         = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);

  // Persist sidebar state
  useEffect(() => {
    const l = localStorage.getItem("sidebar-left");
    const r = localStorage.getItem("sidebar-right");
    if (l !== null) setLeftOpen(l !== "false");
    if (r !== null) setRightOpen(r !== "false");
  }, []);

  const toggleLeft = useCallback(() => setLeftOpen(v => { localStorage.setItem("sidebar-left", String(!v)); return !v; }), []);
  const toggleRight = useCallback(() => setRightOpen(v => { localStorage.setItem("sidebar-right", String(!v)); return !v; }), []);

  // Redirect if session definitively absent (not just loading)
  useEffect(() => {
    if (!isPending && !session) router.push("/login");
  }, [session, isPending, router]);

  const loadProjects = useCallback(() => {
    fetch("/api/projects")
      .then(r => r.ok ? r.json() : { projects: [] })
      .then(d => setProjects(d.projects ?? []))
      .catch(() => {});
  }, []);

  // Fire immediately on mount — don't wait for session to resolve.
  // API returns 401 if not authed; the redirect above handles the UX.
  // This eliminates the session → data waterfall.
  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then(r => r.ok ? r.json() : { projects: [] }).then(d => { setProjects(d.projects ?? []); setProjectsLoading(false); }),
      fetch("/api/auth/me").then(r => r.ok ? r.json() : { isAdmin: false }).then(d => setIsAdmin(d.isAdmin ?? false)),
    ]).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Must be before any early return — Rules of Hooks
  const activeProjectData = useMemo(() => projects.find(p => p.id === activeProject), [projects, activeProject]);

  // Proxy is the primary gate. This client guard is backup only — never
  // paint the protected shell while session is pending or absent.
  if (isPending || !session) {
    return <div className="min-h-screen bg-[#09090b]" aria-hidden />;
  }

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b] relative z-10" style={{ gap: 0 }}>

      {/* Desktop left sidebar */}
      {leftOpen && (
        <div className="hidden md:block">
          <Sidebar
            projects={projects}
            onRefresh={loadProjects}
            activeProject={activeProject}
            onSelectProject={setActiveProject}
            isAdmin={isAdmin}
          />
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div onClick={e => e.stopPropagation()} className="relative w-fit h-full">
            <Sidebar
              projects={projects}
              onRefresh={loadProjects}
              activeProject={activeProject}
              onSelectProject={(id) => { setActiveProject(id); setMobileMenuOpen(false); }}
              isAdmin={isAdmin}
              onClose={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Mobile right panel overlay */}
      {mobileRightOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileRightOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div onClick={e => e.stopPropagation()} className="absolute right-0 top-0 h-full w-[300px] bg-[#09090b] border-l border-white/[0.06] flex flex-col overflow-y-auto" style={{ gap: '1rem', padding: '1.25rem' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">Widgets</span>
              <button onClick={() => setMobileRightOpen(false)} className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all text-base">×</button>
            </div>
            <CalendarWidget />
            <ChronoMatrix projects={projects} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] flex-shrink-0 bg-black/60 backdrop-blur-md">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] rounded transition-all flex-shrink-0"
          >
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <rect width="14" height="1.5" rx="0.75" fill="currentColor"/>
              <rect y="4.25" width="14" height="1.5" rx="0.75" fill="currentColor"/>
              <rect y="8.5" width="14" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </button>
          {/* Desktop collapse button */}
          <div className="hidden md:flex">
            <CollapseButton collapsed={!leftOpen} onClick={toggleLeft} side="left" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              {activeProjectData && (
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: activeProjectData.color, boxShadow: `0 0 8px ${activeProjectData.color}60` }} />
              )}
              <h1 className="text-sm font-semibold text-zinc-100 truncate">
                {activeProjectData?.name ?? "All Projects"}
              </h1>
              {activeProjectData?.description && (
                <span className="text-xs text-zinc-600 hidden lg:block truncate">— {activeProjectData.description}</span>
              )}
            </div>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              {greeting()}, {session?.user?.name?.split(" ")[0] ?? "David"}.
            </p>
          </div>

          <div className="hidden md:block">
            <Clock />
          </div>

          <NotificationBell onSelectProject={setActiveProject} />

          {/* Mobile widgets button */}
          <button
            onClick={() => setMobileRightOpen(true)}
            title="Widgets"
            className="md:hidden w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] rounded-xl transition-all flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </button>

          {/* Profile button */}
          <button
            onClick={() => setProfileOpen(true)}
            title="Profile"
            className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/[0.07] hover:ring-white/[0.25] transition-all flex-shrink-0"
          >
            {session?.user?.image
              ? <img src={session.user.image} alt="avatar" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-cyan-500/40 to-violet-500/40 flex items-center justify-center text-xs font-bold text-white">
                  {session?.user?.name?.[0]?.toUpperCase() ?? "D"}
                </div>
            }
          </button>

          <div className="hidden md:flex">
            <CollapseButton collapsed={!rightOpen} onClick={toggleRight} side="right" />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 overflow-hidden flex flex-col min-w-0 min-h-0" style={{ padding: '1.5rem 1.75rem' }}>
            <KanbanBoard
              projects={projects}
              activeProjectId={activeProject}
              onSelectProject={setActiveProject}
              onRefreshProjects={loadProjects}
              projectsLoading={projectsLoading}
            />
          </div>

          {/* Right panel - hidden on mobile */}
          {rightOpen && (
            <aside className="hidden md:flex w-[300px] flex-shrink-0 flex-col overflow-y-auto border-l border-white/[0.05]" style={{ gap: '1rem', padding: '1.25rem' }}>
              <CalendarWidget />
              <ChronoMatrix projects={projects} />
            </aside>
          )}
        </div>
      </div>

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
