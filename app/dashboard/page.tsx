"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
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
  if (!time) return <div className="w-24 h-8" />;
  return (
    <div className="text-right tabular-nums leading-none">
      <p className="text-[15px] font-mono font-semibold text-zinc-200">
        {time.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false })}
        <span className="text-zinc-600 text-[11px] ml-0.5">
          {time.toLocaleTimeString("en", { second: "2-digit" }).padStart(2, "0")}
        </span>
      </p>
      <p className="text-[10px] text-zinc-600 mt-1.5">
        {time.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
      </p>
    </div>
  );
}

function CollapseButton({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? "Show sidebar" : "Hide sidebar"}
      aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
      aria-expanded={!collapsed}
      className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.06] rounded-lg transition-colors flex-shrink-0"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden
        className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}>
        <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Persist sidebar state
  useEffect(() => {
    const l = localStorage.getItem("sidebar-left");
    if (l !== null) setLeftOpen(l !== "false");
  }, []);

  const toggleLeft = useCallback(() => setLeftOpen(v => { localStorage.setItem("sidebar-left", String(!v)); return !v; }), []);

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

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="flex items-center gap-2 px-4 md:px-6 h-16 border-b border-white/[0.06] flex-shrink-0 bg-black/60 backdrop-blur-md">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            className="md:hidden w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] rounded-lg transition-colors flex-shrink-0"
          >
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden>
              <rect width="14" height="1.5" rx="0.75" fill="currentColor"/>
              <rect y="4.25" width="14" height="1.5" rx="0.75" fill="currentColor"/>
              <rect y="8.5" width="14" height="1.5" rx="0.75" fill="currentColor"/>
            </svg>
          </button>
          {/* Desktop collapse button */}
          <div className="hidden md:flex mr-1">
            <CollapseButton collapsed={!leftOpen} onClick={toggleLeft} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              {activeProjectData && (
                <button onClick={() => setActiveProject(null)}
                  className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0">
                  Projects
                  <span className="text-zinc-700">/</span>
                </button>
              )}
              <span className="flex items-center gap-2 min-w-0">
                {activeProjectData && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0 self-center"
                    style={{ backgroundColor: activeProjectData.color, boxShadow: `0 0 8px ${activeProjectData.color}70` }} />
                )}
                <h1 className="text-[15px] font-semibold text-zinc-100 truncate leading-tight">
                  {activeProjectData?.name ?? "All Projects"}
                </h1>
              </span>
              {activeProjectData?.description && (
                <span className="text-xs text-zinc-600 hidden lg:block truncate">{activeProjectData.description}</span>
              )}
            </div>
            <p className="text-[11px] text-zinc-600 mt-0.5 truncate">
              {greeting()}, {session?.user?.name?.split(" ")[0] ?? "David"}.
            </p>
          </div>

          <div className="hidden md:block mr-1">
            <Clock />
          </div>

          <div className="hidden md:block w-px h-6 bg-white/[0.07] mx-1" aria-hidden />

          <NotificationBell onSelectProject={setActiveProject} />

          {/* Profile button */}
          <button
            onClick={() => setProfileOpen(true)}
            title="Profile"
            aria-label="Open profile"
            className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/[0.12] hover:ring-cyan-400/40 transition-all flex-shrink-0"
          >
            {session?.user?.image
              ? <img src={session.user.image} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-cyan-500/40 to-violet-500/40 flex items-center justify-center text-xs font-bold text-white">
                  {session?.user?.name?.[0]?.toUpperCase() ?? "D"}
                </div>
            }
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div className="flex-1 overflow-hidden flex flex-col min-w-0 min-h-0 px-4 py-5 md:px-7 md:py-6">
            <KanbanBoard
              projects={projects}
              activeProjectId={activeProject}
              onSelectProject={setActiveProject}
              onRefreshProjects={loadProjects}
              projectsLoading={projectsLoading}
            />
          </div>
        </div>
      </div>

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
