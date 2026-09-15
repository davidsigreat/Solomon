"use client";

import { useState, useEffect, useRef } from "react";
import type { Task, Subtask } from "@/types";

const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do", IN_PROGRESS: "In Progress", IN_REVIEW: "In Review", DONE: "Done",
};
const STATUS_DOT: Record<string, string> = {
  TODO: "bg-zinc-500", IN_PROGRESS: "bg-blue-400", IN_REVIEW: "bg-violet-400", DONE: "bg-emerald-400",
};
const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-400", HIGH: "bg-orange-400", MEDIUM: "bg-amber-400", LOW: "bg-emerald-400",
};
const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400", HIGH: "text-orange-400", MEDIUM: "text-amber-400", LOW: "text-emerald-400",
};

interface NeonUser { id: string; name: string | null; email: string | null; image: string | null }

function UserAvatar({ user }: { user: NeonUser }) {
  const label = user.name ?? user.email ?? "?";
  const initials = label.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const cls = "w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#111116]";
  return user.image
    ? <img src={user.image} alt={label} className={`${cls} object-cover`} />
    : <div className={cls} style={{ background: "linear-gradient(135deg,rgba(6,182,212,0.5),rgba(139,92,246,0.5))" }}>{initials}</div>;
}

interface Props {
  task: Task | null;
  onClose: () => void;
  onUpdate: (updated: Task) => void;
  onDelete: (id: string) => void;
}

export default function TaskModal({ task, onClose, onUpdate, onDelete }: Props) {
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus]         = useState<Task["status"]>("TODO");
  const [priority, setPriority]     = useState<Task["priority"]>("MEDIUM");
  const [startDate, setStartDate]   = useState("");
  const [dueDate, setDueDate]       = useState("");
  const [subtasks, setSubtasks]     = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [users, setUsers]             = useState<NeonUser[]>([]);
  const [projectMembers, setProjectMembers] = useState<NeonUser[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [emailInput, setEmailInput]   = useState("");
  const [emailError, setEmailError]   = useState("");
  const [error, setError]           = useState("");
  const overlayRef                  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setStartDate(task.startDate ? new Date(task.startDate).toISOString().slice(0, 10) : "");
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "");
    setSubtasks(task.subtasks ?? []);
    setAssigneeIds((task.assignees ?? []).map(a => a.userId));
    setError("");
  }, [task?.id]);

  // users = project contributors only

  useEffect(() => {
    if (!task?.projectId) return;
    fetch(`/api/projects/${task.projectId}/members`)
      .then(r => r.ok ? r.json() : { members: [] })
      .then(d => {
        const mapped = (d.members ?? []).map((m: { userId: string; name: string | null; email: string | null; image: string | null }) => ({
          id: m.userId, name: m.name, email: m.email, image: m.image,
        }));
        setProjectMembers(mapped);
        setUsers(mapped); // project contributors = the selectable user pool
      })
      .catch(() => {});
  }, [task?.projectId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!task) return null;

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) { setError("Title required"); return; }

    const now = new Date().toISOString();

    // Build optimistic task from current form state
    const optimistic: Task = {
      ...task!,
      title:       title.trim(),
      description: description || null,
      status,
      priority,
      startDate:   startDate || null,
      dueDate:     dueDate || null,
      updatedAt:   now,
      // Merge selected assignees with user info from the loaded users list
      assignees: assigneeIds.map(uid => {
        const existing = task!.assignees?.find(a => a.userId === uid);
        if (existing) return existing;
        const u = users.find(u => u.id === uid);
        return { id: uid, taskId: task!.id, userId: uid, user: u ?? null };
      }) as Task["assignees"],
    };

    // Update UI + close instantly — zero perceived wait time
    onUpdate(optimistic);
    onClose();

    // Diff assignees
    const prev    = (task!.assignees ?? []).map(a => a.userId);
    const toAdd   = assigneeIds.filter(id => !prev.includes(id));
    const toRemove= prev.filter(id => !assigneeIds.includes(id));

    // Fire everything in parallel
    const [patchRes] = await Promise.all([
      fetch(`/api/tasks/${task!.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), description: description || null,
          status, priority,
          startDate: startDate || null, dueDate: dueDate || null,
        }),
      }),
      ...toAdd.map(uid => fetch(`/api/tasks/${task!.id}/assignees`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      })),
      ...toRemove.map(uid => fetch(`/api/tasks/${task!.id}/assignees`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      })),
    ]);

    // Confirm with real server timestamps (silent — UI already updated)
    if (patchRes.ok) {
      const data = await patchRes.json();
      if (data.task) onUpdate({ ...optimistic, ...data.task, assignees: optimistic.assignees });
    }
  }

  async function addSubtask() {
    if (!newSubtask.trim()) return;
    const res = await fetch(`/api/tasks/${task!.id}/subtasks`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newSubtask.trim() }),
    });
    const data = await res.json();
    setSubtasks(prev => [...prev, data.subtask]);
    setNewSubtask("");
  }

  async function toggleSubtask(subtask: Subtask) {
    await fetch(`/api/tasks/${task!.id}/subtasks`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtaskId: subtask.id, completed: !subtask.completed }),
    });
    setSubtasks(prev => prev.map(s => s.id === subtask.id ? { ...s, completed: !s.completed } : s));
  }

  async function deleteSubtask(subtaskId: string) {
    await fetch(`/api/tasks/${task!.id}/subtasks`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subtaskId }),
    });
    setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
  }

  const completedSubs = subtasks.filter(s => s.completed).length;

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4">

      <form onSubmit={handleSave} role="dialog" aria-modal="true" aria-label={`Edit task: ${task.title}`}
        className="w-full max-w-2xl bg-black/70 backdrop-blur-xl border border-white/[0.1] rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] flex-shrink-0 px-5 sm:px-7 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" aria-hidden
              style={{ backgroundColor: task.project.color, boxShadow: `0 0 8px ${task.project.color}80` }} />
            <span className="text-[13px] font-semibold text-zinc-200 truncate">{task.project.name}</span>
            <span className="text-zinc-700 text-sm" aria-hidden>›</span>
            <span className="text-xs text-zinc-600 flex-shrink-0">Edit task</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button type="button" onClick={() => { onDelete(task.id); onClose(); }}
              className="text-xs text-zinc-500 hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20">
              Delete
            </button>
            <button type="button" onClick={onClose} aria-label="Close"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.07] transition-colors text-lg leading-none">×</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-5 px-5 sm:px-7 py-6">

          {/* Title */}
          <div>
            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Task title..." required
              className="w-full bg-transparent text-lg font-semibold text-zinc-100 placeholder-zinc-700 outline-none border-b border-white/[0.07] pb-2 focus:border-cyan-500/40 transition-colors"
            />
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>

          {/* Status + Priority + Dates — 3 columns */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {/* Status */}
            <div>
              <label className="label-caps block mb-2">Status</label>
              <div className="flex flex-col gap-1">
                {STATUSES.map(s => (
                  <button key={s} type="button" onClick={() => setStatus(s as Task["status"])}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      status === s
                        ? "bg-white/[0.08] text-zinc-100 border border-white/[0.12]"
                        : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03]"
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[s]}`} />
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="label-caps block mb-2">Priority</label>
              <div className="flex flex-col gap-1">
                {PRIORITIES.map(p => (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      priority === p
                        ? `bg-white/[0.08] border border-white/[0.12] ${PRIORITY_COLOR[p]}`
                        : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03]"
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[p]}`} />
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="label-caps block mb-1.5">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-zinc-300 outline-none transition-colors" />
              </div>
              <div>
                <label className="label-caps block mb-1.5">Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-zinc-300 outline-none transition-colors" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label-caps block mb-1.5">Description</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What needs to be done?" rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-cyan-500/30 rounded-xl px-3.5 py-3 text-sm text-zinc-300 placeholder-zinc-700 outline-none resize-none transition-colors"
            />
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label-caps">Subtasks</label>
              {subtasks.length > 0 && (
                <span className="text-[10px] text-zinc-600">{completedSubs}/{subtasks.length} done</span>
              )}
            </div>
            {subtasks.length > 0 && (
              <div className="h-1 bg-white/[0.05] rounded-full mb-3 overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full transition-all"
                  style={{ width: `${(completedSubs / subtasks.length) * 100}%` }} />
              </div>
            )}
            <div className="flex flex-col gap-1.5 mb-2">
              {subtasks.map(st => (
                <div key={st.id} className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <button type="button" onClick={() => toggleSubtask(st)}
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                      st.completed ? "bg-cyan-500/30 border-cyan-500/50" : "border-white/20 hover:border-cyan-500/40"
                    }`}>
                    {st.completed && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                  </button>
                  <span className={`text-sm flex-1 ${st.completed ? "line-through text-zinc-600" : "text-zinc-300"}`}>{st.title}</span>
                  <button type="button" onClick={() => deleteSubtask(st.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-400 transition-all text-xs">×</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }}
                placeholder="Add subtask..."
                className="flex-1 bg-white/[0.04] border border-white/[0.07] focus:border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-zinc-300 placeholder-zinc-700 outline-none transition-colors" />
              <button type="button" disabled={!newSubtask.trim()} onClick={addSubtask}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-white/[0.08] text-zinc-500 hover:text-zinc-200 hover:border-white/[0.15] transition-all disabled:opacity-30">
                Add
              </button>
            </div>
          </div>

          {/* Contributors — project contributors only */}
          <div>
            <label className="label-caps block mb-2">Contributors</label>
            {projectMembers.length === 0 ? (
              <p className="text-xs text-zinc-700">No contributors on this project yet. Add them via the project header.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {projectMembers.map(u => {
                  const selected = assigneeIds.includes(u.id);
                  return (
                    <button key={u.id} type="button"
                      onClick={() => setAssigneeIds(prev => selected ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                        selected ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
                                 : "bg-white/[0.04] border border-white/[0.07] text-zinc-400 hover:text-zinc-200"
                      }`}>
                      <UserAvatar user={u} />
                      <div className="text-left leading-tight">
                        <div className="font-medium">{u.name ?? u.email?.split("@")[0]}</div>
                        {u.email && <div className="text-[10px] opacity-60">{u.email}</div>}
                      </div>
                      {selected && <span className="text-cyan-400 ml-1">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Meta */}
          <p className="text-[10px] text-zinc-700 border-t border-white/[0.04] pt-3">
            Created {new Date(task.createdAt).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}
            {" · "}Updated {new Date(task.updatedAt).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.07] flex items-center justify-end flex-shrink-0" style={{ gap: '0.75rem', padding: '1rem 1.75rem' }}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-200 border border-white/[0.07] rounded-xl hover:border-white/[0.15] transition-all">
            Cancel
          </button>
          <button type="submit" disabled={!title.trim()}
            className="px-5 py-2 text-sm font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-xl hover:bg-cyan-500/20 transition-all disabled:opacity-40">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
