"use client";

import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import type { Task, Project } from "@/types";
import EmptyState from "@/components/ui/EmptyState";

const TaskModal = dynamic(() => import("@/components/kanban/TaskModal"), { ssr: false });
const CreateTaskModal = dynamic(() => import("@/components/kanban/CreateTaskModal"), { ssr: false });
const CreateProjectModal = dynamic(() => import("@/components/project/CreateProjectModal"), { ssr: false });
const EditProjectModal = dynamic(() => import("@/components/project/EditProjectModal"), { ssr: false });

type Status = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

const COLUMNS: { id: Status; label: string; color: string; dot: string; accent: string; countColor: string }[] = [
  { id: "TODO",        label: "To Do",       color: "text-zinc-400",    dot: "bg-zinc-500",    accent: "border-zinc-500/30",    countColor: "text-zinc-500 bg-zinc-500/10" },
  { id: "IN_PROGRESS", label: "In Progress", color: "text-blue-400",    dot: "bg-blue-400",    accent: "border-blue-500/30",    countColor: "text-blue-400 bg-blue-500/10" },
  { id: "IN_REVIEW",   label: "In Review",   color: "text-violet-400",  dot: "bg-violet-400",  accent: "border-violet-500/30",  countColor: "text-violet-400 bg-violet-500/10" },
  { id: "DONE",        label: "Done",        color: "text-emerald-400", dot: "bg-emerald-400", accent: "border-emerald-500/30", countColor: "text-emerald-400 bg-emerald-500/10" },
];

const STATUS_ORDER: Status[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const PRIORITY_STYLE: Record<string, { badge: string; dot: string; strip: string }> = {
  CRITICAL: { badge: "text-red-400 bg-red-500/10 border-red-500/20",            dot: "bg-red-400",     strip: "bg-red-500" },
  HIGH:     { badge: "text-orange-400 bg-orange-500/10 border-orange-500/20",   dot: "bg-orange-400",  strip: "bg-orange-500" },
  MEDIUM:   { badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",      dot: "bg-amber-400",   strip: "bg-amber-500" },
  LOW:      { badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",dot: "bg-emerald-400", strip: "bg-emerald-500" },
};

function relativeDue(dateStr: string): string {
  const due = new Date(dateStr);
  const now = new Date();
  const dueMid = new Date(due); dueMid.setHours(0, 0, 0, 0);
  const nowMid = new Date(now); nowMid.setHours(0, 0, 0, 0);
  const diff = Math.round((dueMid.getTime() - nowMid.getTime()) / 86400000);
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff === -1) return "Yesterday";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return `in ${diff}d`;
  return due.toLocaleDateString("en", { month: "short", day: "numeric" });
}

const PRESET_COLORS = ["#06b6d4","#8b5cf6","#4ade80","#f59e0b","#f87171","#38bdf8","#fb923c","#a78bfa"];

const TaskCard = memo(function TaskCard({ task, onMove, onOpen, isDragging, onDragStart, onDragEnd }: {
  task: Task; onMove: (id: string, status: Status) => void; onOpen: (task: Task) => void;
  isDragging: boolean; onDragStart: () => void; onDragEnd: () => void;
}) {
  const currentIdx = STATUS_ORDER.indexOf(task.status);
  const pStyle = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.MEDIUM;
  const completedSubs = task.subtasks.filter(s => s.completed).length;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData("taskId", task.id); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task)}
      className={`group relative border rounded-2xl cursor-pointer transition-all duration-150 select-none backdrop-blur-sm ${
        isDragging ? "opacity-30 scale-95 border-white/10 cursor-grabbing bg-white/[0.03]"
          : "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.18] hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5"
      }`}
      style={{ padding: '0.875rem 0.875rem 0.875rem 1.125rem' }}
    >
      {/* Priority strip — inset from corners so no overflow-hidden needed */}
      <div className={`absolute left-0 w-[3px] ${pStyle.strip} opacity-70`} style={{ top: '0.75rem', bottom: '0.75rem', borderRadius: '0 2px 2px 0' }} />
      {/* Drag handle — desktop only */}
      <div className="hidden md:flex absolute top-3 right-3 flex-col gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        title="Drag to move">
        {[0,1,2].map(i => (
          <div key={i} className="flex gap-[3px]">
            <div className="w-[3px] h-[3px] rounded-full bg-zinc-600" />
            <div className="w-[3px] h-[3px] rounded-full bg-zinc-600" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pStyle.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${pStyle.dot}`} />
          {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
        </span>
        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {currentIdx > 0 && (
            <button onClick={() => onMove(task.id, STATUS_ORDER[currentIdx - 1])}
              className="w-5 h-5 flex items-center justify-center rounded-md bg-white/[0.05] hover:bg-white/[0.12] text-zinc-500 hover:text-zinc-200 transition-all text-xs">←</button>
          )}
          {currentIdx < STATUS_ORDER.length - 1 && (
            <button onClick={() => onMove(task.id, STATUS_ORDER[currentIdx + 1])}
              className="w-5 h-5 flex items-center justify-center rounded-md bg-white/[0.05] hover:bg-cyan-500/20 text-zinc-500 hover:text-cyan-400 transition-all text-xs">→</button>
          )}
        </div>
      </div>

      <p className={`text-sm font-medium leading-snug mb-3 ${task.status === "DONE" ? "line-through text-zinc-600" : "text-zinc-100"}`}>
        {task.title}
      </p>

      {task.description && (
        <p className="text-[11px] text-zinc-600 leading-relaxed mb-3 line-clamp-2">{task.description}</p>
      )}

      {task.subtasks.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-zinc-600">Subtasks</span>
            <span className={`text-[10px] tabular-nums ${completedSubs === task.subtasks.length ? "text-emerald-400/80" : "text-zinc-500"}`}>
              {completedSubs}/{task.subtasks.length}
            </span>
          </div>
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${completedSubs === task.subtasks.length ? "bg-emerald-400/70" : "bg-cyan-400/60"}`}
              style={{ width: `${task.subtasks.length ? (completedSubs / task.subtasks.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {task.assignees.slice(0, 3).map(a => {
            const label = a.user?.name ?? a.user?.email ?? "";
            const initials = label
              ? label.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
              : "?";
            return a.user?.image ? (
              <img key={a.id} src={a.user.image} alt={label} title={label}
                className="w-6 h-6 rounded-full object-cover ring-2 ring-[#0d0d11]" />
            ) : (
              <div key={a.id} title={label}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500/40 to-violet-500/40 ring-2 ring-[#0d0d11] flex items-center justify-center text-[9px] font-bold text-white">
                {initials}
              </div>
            );
          })}
          {task.assignees.length > 3 && (
            <div className="w-6 h-6 rounded-full bg-white/[0.07] ring-2 ring-[#0d0d11] flex items-center justify-center text-[9px] font-semibold text-zinc-400">
              +{task.assignees.length - 3}
            </div>
          )}
        </div>
        {task.dueDate && (() => {
          const label = relativeDue(task.dueDate);
          const isToday = !isOverdue && task.status !== "DONE" && label === "Today";
          return (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border tabular-nums ${
              isOverdue ? "text-red-400 bg-red-500/10 border-red-500/20"
                : isToday ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                : "text-zinc-500 border-white/[0.07]"
            }`}>
              {isOverdue && "⚠ "}{label}
            </span>
          );
        })()}
      </div>
    </div>
  );
});

// Inline edit state for project overview cards
const ProjectCard = memo(function ProjectCard({ project, onSelect, onUpdate, onDelete }: {
  project: Project; onSelect: () => void;
  onUpdate: (id: string, data: { name: string; color: string; description: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: project.name, color: project.color, description: project.description ?? "" });
  const [saving, setSaving] = useState(false);

  const open = project.tasks?.filter(t => t.status !== "DONE").length ?? 0;
  const done = project.tasks?.filter(t => t.status === "DONE").length ?? 0;
  const total = project.tasks?.length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    onUpdate(project.id, form);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} onClick={e => e.stopPropagation()}
        className="bg-[#111116] border border-cyan-500/20 rounded-2xl p-4 flex flex-col gap-3">
        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Project name..." autoFocus
          className="w-full bg-[#0d1117] border border-white/[0.08] focus:border-cyan-500/30 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-colors" />
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Description (optional)" rows={2}
          className="w-full bg-[#0d1117] border border-white/[0.08] focus:border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-zinc-300 placeholder-zinc-700 outline-none resize-none transition-colors" />
        <div className="flex gap-1.5 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
              className={`w-5 h-5 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-1 ring-offset-[#111116] ring-white/40 scale-110" : ""}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(false)}
            className="flex-1 py-1.5 text-xs text-zinc-600 border border-white/[0.07] rounded-xl hover:text-zinc-300 transition-all">Cancel</button>
          <button type="submit" disabled={saving || !form.name.trim()}
            className="flex-1 py-1.5 text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-xl hover:bg-cyan-500/20 transition-all disabled:opacity-40">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="group relative bg-white/[0.03] backdrop-blur-sm border border-white/[0.07] hover:border-white/[0.16] hover:bg-white/[0.06] rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 cursor-pointer"
      style={{ padding: '1.5rem 1.5rem' }}
      onClick={onSelect}>
      {/* Actions */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}>
        <button onClick={() => setEditing(true)}
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/[0.05] hover:bg-white/[0.12] text-zinc-600 hover:text-zinc-200 transition-all text-xs">✎</button>
        <button onClick={() => { if (confirm(`Delete "${project.name}"? All tasks will be deleted.`)) onDelete(project.id); }}
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/[0.05] hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-all text-xs">×</button>
      </div>

      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color, boxShadow: `0 0 8px ${project.color}60` }} />
        <span className="text-sm font-semibold text-zinc-100 truncate pr-12">{project.name}</span>
      </div>

      <p className="text-xs text-zinc-600 mb-4 line-clamp-2 leading-relaxed min-h-[2rem]">
        {project.description || <span className="text-zinc-700">No description</span>}
      </p>

      {total > 0 ? (
        <div className="mb-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-zinc-600 tabular-nums">{done}/{total} done</span>
            <span className="text-[10px] font-semibold text-zinc-500 tabular-nums">{pct}%</span>
          </div>
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: project.color }} />
          </div>
        </div>
      ) : (
        <div className="mb-3.5 h-1 rounded-full bg-white/[0.04]" aria-hidden />
      )}

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-zinc-500 tabular-nums">
          {total === 0 ? "No tasks yet" : `${open} open · ${done} done`}
        </span>
        <span className="text-[10px] font-semibold text-zinc-700 group-hover:text-cyan-400 transition-colors">Open board →</span>
      </div>
    </div>
  );
});

function ProjectOverview({ projects, onSelect, onRefresh, loading }: {
  projects: Project[]; onSelect: (id: string) => void; onRefresh: () => void; loading?: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);

  async function handleDelete(id: string) {
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    onRefresh();
  }

  function handleUpdate() { onRefresh(); }

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">Projects</h2>
            {projects.length > 0 && (
              <span className="text-[11px] font-semibold tabular-nums text-zinc-500 bg-white/[0.05] border border-white/[0.07] px-2 py-0.5 rounded-full">
                {projects.length}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-600 mt-1">Select a project to open its Kanban board</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-colors">
          <span className="text-sm leading-none">+</span> New Project
        </button>
      </div>

      <CreateProjectModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={p => { onSelect(p.id); onRefresh(); setShowCreate(false); }}
      />

      {loading && projects.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 content-start">
          {[80, 60, 90].map((w, i) => (
            <div key={i} className="rounded-2xl border border-white/[0.07] bg-white/[0.02]" style={{ padding: '1.5rem' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="skeleton w-3 h-3 rounded-full" />
                <div className="skeleton rounded-lg" style={{ width: `${w}%`, height: '14px' }} />
              </div>
              <div className="skeleton rounded-lg mb-4" style={{ width: '60%', height: '11px' }} />
              <div className="skeleton rounded-full" style={{ width: '100%', height: '4px' }} />
            </div>
          ))}
        </div>
      ) : projects.length === 0 && !showCreate ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon="📁"
            title="No projects yet"
            description="Projects hold your Kanban board, contributors and task history. Create your first one to get started."
            action={
              <button onClick={() => setShowCreate(true)}
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/20 transition-colors">
                + New Project
              </button>
            }
          />
        </div>
      ) : (
        <div className="fade-up grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 content-start overflow-y-auto pb-1">
          {projects.map(p => (
            <ProjectCard key={p.id} project={p}
              onSelect={() => onSelect(p.id)}
              onUpdate={() => handleUpdate()}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ProjectMemberInfo {
  memberId: string; userId: string; name: string | null; email: string | null; image: string | null;
  role?: string;
}

function MemberAvatar({ m, size = 7 }: { m: { name?: string | null; email?: string | null; image?: string | null }; size?: number }) {
  const initials = (m.name ?? m.email ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const cls = `rounded-full ring-2 ring-[#09090b] flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white`;
  return m.image
    ? <img src={m.image} alt={m.name ?? ""} className={cls} style={{ width: `${size * 4}px`, height: `${size * 4}px`, objectFit: 'cover' }} />
    : <div className={cls} style={{ width: `${size * 4}px`, height: `${size * 4}px`, background: 'linear-gradient(135deg,rgba(6,182,212,0.5),rgba(139,92,246,0.5))' }}>{initials}</div>;
}

interface NeonUserSimple { id: string; name: string | null; email: string | null; image: string | null }

function ProjectHeader({ project, taskTotal, done, pct, projectId, onProjectUpdated, onProjectDeleted }: {
  project: Project; taskTotal: number; done: number; pct: number; projectId: string;
  onProjectUpdated: (p: Project) => void;
  onProjectDeleted: () => void;
}) {
  const [members, setMembers]       = useState<ProjectMemberInfo[]>([]);
  const [myRole, setMyRole]         = useState<string | null>(null);
  const [allUsers, setAllUsers]     = useState<NeonUserSimple[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos]   = useState({ top: 0, right: 0 });
  const [menuOpen, setMenuOpen]     = useState(false);
  const [menuPos, setMenuPos]       = useState({ top: 0, right: 0 });
  const [editOpen, setEditOpen]     = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [saving, setSaving]         = useState(false);
  const pickerRef                   = useRef<HTMLDivElement>(null);
  const menuRef                     = useRef<HTMLDivElement>(null);
  const menuBtnRef                  = useRef<HTMLButtonElement>(null);

  const isOwner = myRole === "OWNER";

  useEffect(() => {
    fetch(`/api/projects/${projectId}/members`)
      .then(r => r.ok ? r.json() : { members: [], myRole: null })
      .then(d => { setMembers(d.members ?? []); setMyRole(d.myRole ?? null); })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (!pickerOpen || allUsers.length > 0) return;
    fetch("/api/users").then(r => r.ok ? r.json() : { users: [] }).then(d => setAllUsers(d.users ?? [])).catch(() => {});
  }, [pickerOpen, allUsers.length]);

  useEffect(() => {
    if (!pickerOpen) return;
    function down(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
          menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node))
        setPickerOpen(false);
    }
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [pickerOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function down(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node))
        setMenuOpen(false);
    }
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [menuOpen]);

  const memberIds = new Set(members.map(m => m.userId));

  function openMenu() {
    if (menuBtnRef.current) {
      const r = menuBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setMenuOpen(v => !v);
  }

  function openPicker() {
    setMenuOpen(false);
    if (menuBtnRef.current) {
      const r = menuBtnRef.current.getBoundingClientRect();
      setPickerPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setPickerOpen(true);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    setMenuOpen(false);
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    onProjectDeleted();
  }

  async function toggleMember(user: NeonUserSimple) {
    setSaving(true);
    if (memberIds.has(user.id)) {
      await fetch(`/api/projects/${projectId}/members`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      setMembers(prev => prev.filter(m => m.userId !== user.id));
    } else {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (res.ok && data.member) {
        setMembers(prev => [...prev, { memberId: data.member.userId, userId: user.id, name: user.name, email: user.email, image: user.image }]);
      } else {
        setEmailError(data.error ?? "Failed to add contributor");
      }
    }
    setSaving(false);
  }

  async function addByEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailError(""); setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailInput }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setEmailError(data.error ?? "User not found — they need to sign in first"); return; }
    if (data.member) {
      setMembers(prev => [...prev.filter(m => m.userId !== data.member.userId), {
        memberId: data.member.userId, userId: data.member.userId,
        name: data.member.name, email: data.member.email, image: data.member.image,
      }]);
      setAllUsers([]);
    }
    setEmailInput("");
  }

  return (
    <>
      <div className="flex-shrink-0 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm overflow-hidden mb-5">
        <div className="h-[3px] w-full" style={{ backgroundColor: project.color, boxShadow: `0 0 12px ${project.color}55` }} />
        <div className="flex items-start gap-4 flex-wrap px-5 py-4">

          {/* Left: name + description + progress */}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-zinc-100 truncate leading-tight">{project.name}</h2>
            {project.description && <p className="text-xs text-zinc-500 mt-1 leading-relaxed line-clamp-2">{project.description}</p>}
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 max-w-[220px] h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: project.color }} />
              </div>
              <span className="text-[11px] text-zinc-500 tabular-nums flex-shrink-0">
                {taskTotal === 0 ? "No tasks yet" : `${done}/${taskTotal} done · ${pct}%`}
              </span>
            </div>
          </div>

          {/* Right: member avatars + ⋯ menu */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="flex -space-x-2">
              {members.slice(0, 5).map(m => (
                <div key={m.userId} title={m.name ?? m.email ?? m.userId}>
                  <MemberAvatar m={m} size={7} />
                </div>
              ))}
              {members.length > 5 && (
                <div className="w-7 h-7 rounded-full bg-white/[0.08] ring-2 ring-[#09090b] flex items-center justify-center text-[10px] text-zinc-400">
                  +{members.length - 5}
                </div>
              )}
            </div>

            {/* Triple-dot menu button */}
            <button ref={menuBtnRef} onClick={openMenu}
              aria-label="Project options" aria-expanded={menuOpen} title="Project options"
              className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-colors text-base leading-none ${
                menuOpen ? "bg-white/[0.08] text-zinc-100 border-white/[0.18]" : "border-white/[0.08] text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.05] hover:border-white/[0.18]"
              }`}>
              ⋯
            </button>
          </div>
        </div>
      </div>

      {/* ⋯ dropdown menu — portalled */}
      {menuOpen && typeof document !== "undefined" && createPortal(
        <div ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999, width: '11rem' }}
          className="pop-in bg-[#111116] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden py-1">
          <button onClick={() => { setMenuOpen(false); setEditOpen(true); }}
            className="w-full flex items-center gap-2.5 text-xs text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-100 transition-colors text-left"
            style={{ padding: '0.625rem 1rem' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
            Edit Project
          </button>
          <button onClick={openPicker}
            className="w-full flex items-center gap-2.5 text-xs text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-100 transition-colors text-left"
            style={{ padding: '0.625rem 1rem' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M2 10c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            Contributors
          </button>
          <div className="h-px bg-white/[0.06] my-1" />
          <button onClick={handleDelete}
            className="w-full flex items-center gap-2.5 text-xs text-red-400 hover:bg-red-500/[0.08] transition-colors text-left"
            style={{ padding: '0.625rem 1rem' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M4 3v6.5a.5.5 0 00.5.5h3a.5.5 0 00.5-.5V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Delete Project
          </button>
        </div>,
        document.body
      )}

      {/* Contributors picker — portalled */}
      {pickerOpen && typeof document !== "undefined" && createPortal(
        <div ref={pickerRef}
          style={{ position: 'fixed', top: pickerPos.top, right: pickerPos.right, zIndex: 9999, width: '18rem' }}
          className="pop-in bg-[#111116] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
          <div className="border-b border-white/[0.06]" style={{ padding: '0.75rem 1rem' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-300">Contributors</p>
              <button onClick={() => setPickerOpen(false)} className="text-zinc-600 hover:text-zinc-300 text-sm leading-none">×</button>
            </div>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              {isOwner ? "Click to add/remove · set roles" : "View only — contact owner to change"}
            </p>
          </div>

          {/* Current members with roles */}
          {members.length > 0 && (
            <div className="border-b border-white/[0.06]">
              {members.map(m => (
                <div key={m.userId} className="flex items-center gap-2.5" style={{ padding: '0.5rem 1rem' }}>
                  <MemberAvatar m={m} size={5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate">{m.name ?? m.email}</p>
                  </div>
                  {isOwner ? (
                    <div className="flex items-center gap-1.5">
                      <select value={m.role ?? "EDITOR"} disabled={saving}
                        onChange={async e => {
                          setSaving(true);
                          await fetch(`/api/projects/${projectId}/members`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: m.userId, role: e.target.value }),
                          });
                          setMembers(prev => prev.map(x => x.userId === m.userId ? { ...x, role: e.target.value } : x));
                          setSaving(false);
                        }}
                        className="text-[9px] font-semibold bg-white/[0.04] border border-white/[0.08] rounded-lg text-zinc-400 outline-none cursor-pointer"
                        style={{ padding: '0.2rem 0.4rem' }}>
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                      <button onClick={() => toggleMember({ id: m.userId, name: m.name, email: m.email, image: m.image })} disabled={saving}
                        className="text-zinc-700 hover:text-red-400 transition-colors text-xs leading-none">×</button>
                    </div>
                  ) : (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                      m.role === "OWNER" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                      m.role === "VIEWER" ? "text-zinc-500 border-zinc-600/30 bg-zinc-500/10" :
                      "text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
                    }`}>{m.role ?? "EDITOR"}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new — owner only */}
          {isOwner && (
            <div className="max-h-36 overflow-y-auto">
              {allUsers.filter(u => !memberIds.has(u.id)).map(u => (
                <button key={u.id} onClick={() => toggleMember(u)} disabled={saving}
                  className="w-full flex items-center gap-3 hover:bg-white/[0.04] transition-colors text-left"
                  style={{ padding: '0.5rem 1rem' }}>
                  <MemberAvatar m={u} size={5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-400 truncate">{u.name ?? u.email}</p>
                  </div>
                  <span className="text-[10px] text-zinc-600">+ Add</span>
                </button>
              ))}
              {allUsers.filter(u => !memberIds.has(u.id)).length === 0 && allUsers.length > 0 && (
                <p className="text-[10px] text-zinc-700 text-center py-2">All users added</p>
              )}
            </div>
          )}

          <div className="border-t border-white/[0.06]" style={{ padding: '0.75rem 1rem' }}>
            {isOwner && <form onSubmit={addByEmail} className="flex gap-2">
              <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                placeholder="Add by email..." required
                className="flex-1 bg-[#09090b] border border-white/[0.08] focus:border-cyan-500/40 rounded-lg text-xs text-zinc-200 placeholder-zinc-700 outline-none"
                style={{ padding: '0.375rem 0.5rem' }} />
              <button type="submit" disabled={saving}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all disabled:opacity-40">
                Add
              </button>
            </form>}
            {emailError && <p className="text-[10px] text-red-400 mt-1">{emailError}</p>}
          </div>
        </div>,
        document.body
      )}

      {/* Edit project modal */}
      <EditProjectModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        project={project}
        onUpdated={p => { onProjectUpdated(p); setEditOpen(false); }}
      />
    </>
  );
}

interface KanbanBoardProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onRefreshProjects: () => void;
  projectsLoading?: boolean;
}

export default function KanbanBoard({ projects, activeProjectId, onSelectProject, onRefreshProjects, projectsLoading }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createModal, setCreateModal] = useState<{ open: boolean; status: Status }>({ open: false, status: "TODO" });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);
  const dragCounter = useRef<Record<Status, number>>({ TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 });

  const loadTasks = useCallback(async () => {
    if (!activeProjectId) return;
    setLoading(true);
    const res = await fetch(`/api/tasks?projectId=${activeProjectId}`);
    const data = await res.json();
    setTasks(data.tasks ?? []);
    setLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) { setTasks([]); return; }
    loadTasks();
  }, [loadTasks, activeProjectId]);

  const moveTask = useCallback(async (id: string, status: Status) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    setTasks(prev => prev.map(t => t.id === id ? data.task : t));
    setSelectedTask(prev => prev?.id === id ? data.task : prev);
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, col: Status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) moveTask(taskId, col);
    setDragOverCol(null); setDraggingId(null);
    dragCounter.current = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
  }, [moveTask]);

  // Pre-group tasks by status once per render instead of filtering 4× in JSX
  const tasksByStatus = useMemo(() => {
    const map: Record<Status, Task[]> = { TODO: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [] };
    for (const t of tasks) map[t.status as Status]?.push(t);
    return map;
  }, [tasks]);

  if (!activeProjectId) {
    return <ProjectOverview projects={projects} onSelect={onSelectProject} onRefresh={onRefreshProjects} loading={projectsLoading} />;
  }

  const activeProject = projects.find(p => p.id === activeProjectId);
  const done = tasks.filter(t => t.status === "DONE").length;
  const pct  = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <>
      {/* Project header banner */}
      {activeProject && (
        <ProjectHeader
          project={activeProject} taskTotal={tasks.length} done={done} pct={pct} projectId={activeProjectId}
          onProjectUpdated={p => onRefreshProjects()}
          onProjectDeleted={() => { onSelectProject(""); onRefreshProjects(); }}
        />
      )}
      <div className="flex flex-1 min-h-0 overflow-x-auto md:overflow-x-hidden snap-x snap-mandatory md:snap-none pb-2 md:pb-0 gap-3 md:gap-4">
        {COLUMNS.map(col => {
          const colTasks = tasksByStatus[col.id];
          const isOver = dragOverCol === col.id && !!draggingId && tasks.find(t => t.id === draggingId)?.status !== col.id;

          return (
            <div key={col.id} className="flex flex-col flex-shrink-0 w-[85vw] snap-start min-h-0 md:flex-1 md:w-auto"
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
              onDragEnter={() => { dragCounter.current[col.id]++; setDragOverCol(col.id); }}
              onDragLeave={() => { dragCounter.current[col.id]--; if (dragCounter.current[col.id] === 0) setDragOverCol(null); }}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 mb-3 px-3 pb-2.5 border-b border-white/[0.05]">
                <span className={`w-2 h-2 rounded-full ${col.dot} ${col.id === "IN_PROGRESS" ? "animate-pulse" : ""}`} aria-hidden />
                <h3 className={`text-[11px] font-bold uppercase tracking-[0.12em] ${col.color}`}>{col.label}</h3>
                <span className={`ml-auto text-[10px] font-semibold tabular-nums min-w-[1.25rem] text-center px-1.5 py-0.5 rounded-full ${col.countColor}`}>
                  {colTasks.length}
                </span>
              </div>

              <div className={`flex flex-col gap-2.5 flex-1 overflow-y-auto rounded-2xl p-2 transition-colors duration-200 ${
                isOver ? `border-2 border-dashed ${col.accent} bg-white/[0.025]` : "border-2 border-transparent"
              }`}>
                {loading ? (
                  <div className="flex flex-col gap-3 pt-1">
                    {[70, 45, 85].map((w, i) => (
                      <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02]" style={{ padding: '0.875rem 1rem' }}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="skeleton rounded-full" style={{ width: `${w * 0.6}px`, height: '18px' }} />
                        </div>
                        <div className="skeleton rounded-lg mb-2" style={{ width: `${w}%`, height: '14px' }} />
                        <div className="skeleton rounded-lg" style={{ width: `${w * 0.7}%`, height: '11px' }} />
                      </div>
                    ))}
                  </div>
                ) : colTasks.length === 0 ? (
                  <button
                    onClick={() => setCreateModal({ open: true, status: col.id })}
                    className={`flex flex-col items-center justify-center gap-1 h-24 w-full rounded-xl border border-dashed transition-colors ${
                      isOver
                        ? "border-white/25 bg-white/[0.03] text-zinc-300"
                        : "border-white/[0.07] text-zinc-700 hover:border-white/[0.14] hover:text-zinc-500 hover:bg-white/[0.02]"
                    }`}>
                    <span className="text-[11px] font-medium">{isOver ? "Drop here" : "Nothing here"}</span>
                    {!isOver && <span className="text-[10px]">Click to add a task</span>}
                  </button>
                ) : (
                  colTasks.map(task => (
                    <TaskCard key={task.id} task={task}
                      onMove={moveTask} onOpen={setSelectedTask}
                      isDragging={draggingId === task.id}
                      onDragStart={() => setDraggingId(task.id)}
                      onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                    />
                  ))
                )}

                {/* Add task button → opens full modal */}
                {colTasks.length > 0 && (
                  <button
                    onClick={() => setCreateModal({ open: true, status: col.id })}
                    className="flex items-center gap-2 w-full px-3.5 py-2.5 rounded-xl text-[13px] text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="text-base leading-none">+</span> Add task
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create task modal */}
      <CreateTaskModal
        isOpen={createModal.open}
        onClose={() => setCreateModal(m => ({ ...m, open: false }))}
        projectId={activeProjectId}
        projects={projects}
        defaultStatus={createModal.status}
        onCreated={task => setTasks(prev => [task, ...prev])}
      />

      {/* Task detail modal */}
      <TaskModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={updated => {
          setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
          setSelectedTask(updated);
        }}
        onDelete={id => { deleteTask(id); setSelectedTask(null); }}
      />
    </>
  );
}
