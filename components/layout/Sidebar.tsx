"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Project } from "@/types";

const PRESET_COLORS = [
  "#06b6d4","#8b5cf6","#4ade80","#f59e0b",
  "#f87171","#38bdf8","#fb923c","#a78bfa",
];

interface SidebarProps {
  projects: Project[];
  onRefresh: () => void;
  activeProject: string | null;
  onSelectProject: (id: string | null) => void;
  isAdmin?: boolean;
  onClose?: () => void;
}

function NavItem({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group relative w-full flex items-center gap-2.5 pl-4 pr-3 py-2 rounded-xl text-[13px] transition-colors ${
        active
          ? "bg-white/[0.07] text-zinc-100 font-medium"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-cyan-400 transition-all ${
          active ? "h-4 opacity-100" : "h-0 opacity-0"
        }`}
      />
      <span className={`flex-shrink-0 transition-colors ${active ? "text-cyan-300" : "text-zinc-600 group-hover:text-zinc-400"}`}>
        {icon}
      </span>
      {label}
    </button>
  );
}

export default function Sidebar({ projects, onRefresh, activeProject, onSelectProject, isAdmin, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", color: "#8b5cf6", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const onDashboard = pathname === "/dashboard";

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", color: "#8b5cf6", description: "" });
    setShowForm(false);
    setSubmitting(false);
    onRefresh();
  }

  async function deleteProject(id: string, name: string) {
    if (!confirm(`Delete "${name}"? All tasks will be deleted.`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (activeProject === id) onSelectProject(null);
    onRefresh();
  }

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col bg-black/40 backdrop-blur-md border-r border-white/[0.07] h-screen sticky top-0 z-20 relative">
      {onClose && (
        <button onClick={onClose} aria-label="Close menu"
          className="absolute top-4 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors text-base leading-none z-10">×</button>
      )}

      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <button onClick={() => { onSelectProject(null); router.push("/dashboard"); }}
          className="flex items-center gap-2.5 text-left group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center transition-shadow group-hover:shadow-[0_0_14px_rgba(6,182,212,0.25)]">
            <span className="text-[11px] font-black text-cyan-300 font-mono">S</span>
          </div>
          <div>
            <p className="text-[13px] font-bold tracking-[0.18em] text-white font-mono leading-none">SOLOMON</p>
            <p className="text-[8px] text-zinc-600 tracking-[0.2em] mt-1">PERSONAL COUNSEL</p>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav className="px-3 pb-3 flex flex-col gap-0.5">
        <NavItem
          label="All Projects"
          active={onDashboard && activeProject === null}
          onClick={() => { onSelectProject(null); if (!onDashboard) router.push("/dashboard"); }}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <rect x="1" y="1" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.8"/>
              <rect x="8" y="1" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.45"/>
              <rect x="1" y="8" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.45"/>
              <rect x="8" y="8" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.8"/>
            </svg>
          }
        />
        <NavItem
          label="Analytics"
          active={pathname === "/analytics"}
          onClick={() => router.push("/analytics")}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <polyline points="1,11 4,7 7,9 10,4 13,5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <circle cx="13" cy="5" r="1.2" fill="currentColor"/>
            </svg>
          }
        />
        <NavItem
          label="Notifications"
          active={pathname === "/notifications"}
          onClick={() => router.push("/notifications")}
          icon={
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden>
              <path d="M7.5 1.5C5.015 1.5 3 3.515 3 6v3.5L1.5 11h12L12 9.5V6c0-2.485-2.015-4.5-4.5-4.5Z"
                stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M6 11.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          }
        />
      </nav>

      <div className="mx-5 border-t border-white/[0.05]" />

      {/* Projects */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex items-center justify-between pl-4 pr-1 mb-2.5">
          <span className="flex items-baseline gap-1.5">
            <span className="label-caps">Projects</span>
            {projects.length > 0 && (
              <span className="text-[10px] text-zinc-700 tabular-nums">{projects.length}</span>
            )}
          </span>
          <button
            onClick={() => setShowForm((v) => !v)}
            aria-label={showForm ? "Cancel new project" : "New project"}
            title={showForm ? "Cancel" : "New project"}
            className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors text-base leading-none ${
              showForm ? "bg-white/[0.07] text-zinc-200" : "text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.06]"
            }`}
          >
            {showForm ? "×" : "+"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="pop-in mb-3 flex flex-col gap-2.5 p-3 bg-white/[0.03] rounded-xl border border-white/[0.07]">
            <input
              autoFocus type="text" placeholder="Project name..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg px-2.5 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none focus:border-violet-500/50 transition-colors"
            />
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  aria-label={`Color ${c}`}
                  className={`w-4 h-4 rounded-full transition-transform flex-shrink-0 hover:scale-110 ${
                    form.color === c ? "ring-2 ring-offset-2 ring-offset-[#0b0b0f] ring-white/50 scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button type="submit" disabled={submitting || !form.name.trim()}
              className="w-full py-2 text-[11px] font-semibold text-violet-300 border border-violet-500/30 bg-violet-500/10 rounded-lg hover:bg-violet-500/20 transition-colors disabled:opacity-40 disabled:hover:bg-violet-500/10">
              {submitting ? "Creating…" : "Create Project"}
            </button>
          </form>
        )}

        <div className="flex flex-col gap-0.5">
          {projects.length === 0 && !showForm && (
            <div className="px-4 py-6 text-center">
              <p className="text-[11px] text-zinc-600 leading-relaxed">No projects yet</p>
              <button onClick={() => setShowForm(true)}
                className="text-[11px] text-cyan-400/80 hover:text-cyan-300 transition-colors mt-1.5">
                Create your first →
              </button>
            </div>
          )}
          {projects.map((p) => {
            const active = activeProject === p.id;
            return (
              <div key={p.id}
                onClick={() => { onSelectProject(active ? null : p.id); if (!onDashboard) router.push("/dashboard"); }}
                className={`group relative flex items-center gap-2.5 pl-4 pr-2 py-2 rounded-xl cursor-pointer transition-colors ${
                  active ? "bg-white/[0.06]" : "hover:bg-white/[0.035]"
                }`}>
                <span aria-hidden
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all ${active ? "h-4 opacity-100" : "h-0 opacity-0"}`}
                  style={{ backgroundColor: p.color }} />
                <span className="w-2 h-2 rounded-full flex-shrink-0 transition-shadow"
                  style={{ backgroundColor: p.color, boxShadow: active ? `0 0 8px ${p.color}70` : "none" }} />
                <span className={`text-xs flex-1 truncate transition-colors ${
                  active ? "text-zinc-100 font-medium" : "text-zinc-500 group-hover:text-zinc-200"
                }`}>{p.name}</span>
                {p.tasks && p.tasks.length > 0 && (
                  <span className="text-[9px] text-zinc-700 tabular-nums group-hover:opacity-0 transition-opacity">{p.tasks.length}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteProject(p.id, p.name); }}
                  aria-label={`Delete ${p.name}`}
                  className="absolute right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-zinc-600 hover:text-red-400 transition-all text-sm leading-none w-4 flex items-center justify-center"
                >×</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/[0.05] flex flex-col gap-1">
        {isAdmin && (
          <NavItem
            label="Admin Panel"
            active={pathname === "/admin"}
            onClick={() => router.push("/admin")}
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M7 1.4v1.6M7 11v1.6M12.6 7H11M3 7H1.4M10.96 3.04l-1.13 1.13M4.17 9.83l-1.13 1.13M10.96 10.96l-1.13-1.13M4.17 4.17L3.04 3.04"
                  stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            }
          />
        )}
        <div className="flex items-center gap-2 px-4 pt-2">
          <span className="relative w-1.5 h-1.5 flex-shrink-0">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
            <span className="relative block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[9px] text-zinc-700 font-mono tracking-[0.18em]">SYSTEM ONLINE</span>
        </div>
      </div>
    </aside>
  );
}
