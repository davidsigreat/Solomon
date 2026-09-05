"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/types";

const PRESET_COLORS = [
  "#06b6d4","#8b5cf6","#4ade80","#f59e0b",
  "#f87171","#38bdf8","#fb923c","#a78bfa",
];

export type DashboardView = "board" | "command";

interface SidebarProps {
  projects: Project[];
  onRefresh: () => void;
  activeProject: string | null;
  onSelectProject: (id: string | null) => void;
  activeView?: DashboardView;
  onSelectView?: (view: DashboardView) => void;
  isAdmin?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ projects, onRefresh, activeProject, onSelectProject, activeView = "board", onSelectView, isAdmin, onClose }: SidebarProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", color: "#8b5cf6", description: "" });
  const [submitting, setSubmitting] = useState(false);

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
        <button onClick={onClose} className="absolute top-4 right-3 w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all text-base leading-none z-10">×</button>
      )}
      {/* Logo */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center">
            <span className="text-[10px] font-black text-cyan-300 font-mono">S</span>
          </div>
          <div>
            <p className="text-sm font-bold tracking-widest text-white font-mono leading-none">SOLOMON</p>
            <p className="text-[8px] text-zinc-600 tracking-[0.2em] mt-0.5">PERSONAL COUNSEL</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="px-3 pb-2 flex flex-col gap-1">
        <button
          onClick={() => {
            onSelectView?.("command");
            onClose?.();
          }}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm transition-all ${
            activeView === "command"
              ? "bg-white/[0.07] text-zinc-100 font-medium"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
            <path d="M2 3.5h10M2 7h7M2 10.5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Command Center
        </button>
        <button
          onClick={() => {
            onSelectView?.("board");
            onSelectProject(null);
          }}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm transition-all ${
            activeView === "board" && activeProject === null
              ? "bg-white/[0.07] text-zinc-100 font-medium"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
            <rect x="1" y="1" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.7"/>
            <rect x="8" y="1" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.4"/>
            <rect x="1" y="8" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.4"/>
            <rect x="8" y="8" width="5" height="5" rx="1.5" fill="currentColor" opacity="0.7"/>
          </svg>
          All Projects
        </button>
        <button
          onClick={() => router.push("/analytics")}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm transition-all text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
            <polyline points="1,11 4,7 7,9 10,4 13,5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7"/>
            <circle cx="13" cy="5" r="1" fill="currentColor" opacity="0.7"/>
          </svg>
          Analytics
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-white/[0.05]" />

      {/* Projects */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-zinc-600 uppercase">Projects</span>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="w-5 h-5 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all text-base leading-none"
          >
            {showForm ? "×" : "+"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-3 flex flex-col gap-2 p-2.5 bg-white/[0.03] rounded-xl border border-white/[0.06]">
            <input
              autoFocus type="text" placeholder="Project name..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-700 outline-none focus:border-violet-500/40 transition-colors"
            />
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className={`w-4 h-4 rounded-full transition-all flex-shrink-0 ${
                    form.color === c ? "ring-2 ring-offset-1 ring-offset-[#0d1424] ring-white/40 scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button type="submit" disabled={submitting || !form.name.trim()}
              className="w-full py-1.5 text-[11px] font-semibold text-violet-400 border border-violet-500/30 bg-violet-500/10 rounded-lg hover:bg-violet-500/20 transition-all disabled:opacity-40">
              Create Project
            </button>
          </form>
        )}

        <div className="flex flex-col gap-1">
          {projects.length === 0 && !showForm && (
            <p className="text-[11px] text-zinc-700 px-3 py-3 text-center">No projects yet.<br />
              <button onClick={() => setShowForm(true)} className="text-zinc-500 hover:text-zinc-300 transition-colors mt-1">Create one →</button>
            </p>
          )}
          {projects.map((p) => (
            <div key={p.id}
              onClick={() => {
                onSelectView?.("board");
                onSelectProject(activeProject === p.id ? null : p.id);
              }}
              className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-xl cursor-pointer transition-all ${
                activeProject === p.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
              }`}>
              <div className="w-2 h-2 rounded-full flex-shrink-0 transition-all"
                style={{ backgroundColor: p.color, boxShadow: activeProject === p.id ? `0 0 8px ${p.color}70` : "none" }} />
              <span className={`text-xs flex-1 truncate transition-colors ${
                activeProject === p.id ? "text-zinc-100 font-medium" : "text-zinc-500 group-hover:text-zinc-300"
              }`}>{p.name}</span>
              {p.tasks && p.tasks.length > 0 && (
                <span className="text-[9px] text-zinc-700 group-hover:text-zinc-600 transition-colors">{p.tasks.length}</span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); deleteProject(p.id, p.name); }}
                className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-400 transition-all text-sm leading-none w-4 flex items-center justify-center"
              >×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-5 border-t border-white/[0.05] flex flex-col gap-1.5">
        {isAdmin && (
          <button onClick={() => router.push("/admin")}
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04] transition-all text-xs">
            <span>⚙</span> Admin Panel
          </button>
        )}
        <div className="flex items-center gap-2 px-3 py-1">
          <div className="relative w-1.5 h-1.5 flex-shrink-0">
            <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
            <div className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[9px] text-zinc-700 font-mono tracking-widest">SYSTEM ONLINE</span>
        </div>
      </div>
    </aside>
  );
}
