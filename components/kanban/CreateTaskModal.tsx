"use client";

import { useEffect, useRef, useState } from "react";
import type { Task, Project } from "@/types";

const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;
const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do", IN_PROGRESS: "In Progress", IN_REVIEW: "In Review", DONE: "Done",
};
const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400", HIGH: "text-orange-400", MEDIUM: "text-amber-400", LOW: "text-emerald-400",
};

interface NeonUser { id: string; name: string | null; email: string; image: string | null }

function UserAvatar({ user, size = 7 }: { user: NeonUser; size?: number }) {
  const initials = user.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? user.email[0].toUpperCase();
  const cls = `w-${size} h-${size} rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#0d1117]`;
  return user.image
    ? <img src={user.image} alt={user.name ?? ""} className={`${cls} object-cover`} />
    : <div className={`${cls} bg-gradient-to-br from-cyan-500/50 to-violet-500/50`}>{initials}</div>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projects: Project[];
  defaultStatus?: string;
  onCreated: (task: Task) => void;
}

export default function CreateTaskModal({ isOpen, onClose, projectId, projects, defaultStatus = "TODO", onCreated }: Props) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    status: defaultStatus,
    projectId,
    startDate: "",
    dueDate: "",
  });
  const [subtasks, setSubtasks] = useState<string[]>([""]);
  const [contributors, setContributors] = useState<string[]>([]);
  const [users, setUsers] = useState<NeonUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 50);
      // Load only this project's contributors for assignment
      fetch(`/api/projects/${projectId}/members`)
        .then(r => r.ok ? r.json() : { members: [] })
        .then(d => setUsers((d.members ?? []).map((m: { userId: string; name: string | null; email: string | null; image: string | null }) => ({
          id: m.userId, name: m.name, email: m.email, image: m.image,
        })))
        ).catch(() => {});
      setForm(f => ({ ...f, status: defaultStatus, projectId }));
    } else {
      setForm({ title: "", description: "", priority: "MEDIUM", status: defaultStatus, projectId, startDate: "", dueDate: "" });
      setSubtasks([""]);
      setContributors([]);
      setError("");
    }
  }, [isOpen, defaultStatus, projectId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title required"); return; }
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed to create task"); setSubmitting(false); return; }

    const task: Task = data.task;

    // Batch-create all subtasks in one request
    const validSubs = subtasks.filter(s => s.trim());
    if (validSubs.length > 0) {
      await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles: validSubs }),
      });
    }

    // Persist selected contributors
    if (contributors.length > 0) {
      await Promise.all(contributors.map(uid =>
        fetch(`/api/tasks/${task.id}/assignees`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: uid }),
        })
      ));
    }

    // Reload task with subtasks + assignees
    const fullRes = await fetch(`/api/tasks/${task.id}`);
    const fullData = fullRes.ok ? await fullRes.json() : { task };
    onCreated(fullData.task ?? task);
    setSubmitting(false);
    onClose();
  }

  const addSubtaskField = () => setSubtasks(s => [...s, ""]);
  const updateSubtask = (i: number, v: string) => setSubtasks(s => s.map((x, j) => j === i ? v : x));
  const removeSubtask = (i: number) => setSubtasks(s => s.filter((_, j) => j !== i));
  const toggleContributor = (id: string) =>
    setContributors(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id]);

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/55 backdrop-blur-sm md:p-4"
    >
      <div role="dialog" aria-modal="true" aria-label="New task"
        className="w-full md:max-w-2xl bg-black/70 backdrop-blur-xl border border-white/[0.1] md:rounded-2xl rounded-t-2xl shadow-2xl shadow-black/60 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 sm:px-7 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">New Task</h2>
          <button onClick={onClose} aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.07] transition-colors text-lg">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 px-5 sm:px-7 py-6">
            {/* Title */}
            <div>
              <input
                ref={titleRef}
                type="text"
                placeholder="Task title..."
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-transparent text-lg font-semibold text-zinc-100 placeholder-zinc-700 outline-none border-b border-white/[0.07] pb-2 focus:border-cyan-500/40 transition-colors"
              />
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="label-caps block mb-1.5">Description</label>
              <textarea
                placeholder="What needs to be done?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full bg-[#111116] border border-white/[0.07] focus:border-cyan-500/30 rounded-xl px-3.5 py-3 text-sm text-zinc-300 placeholder-zinc-700 outline-none resize-none transition-colors"
              />
            </div>

            {/* Grid: Priority + Status + Project */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
              <div>
                <label className="label-caps block mb-1.5">Priority</label>
                <div className="flex flex-col gap-1">
                  {PRIORITIES.map(p => (
                    <button key={p} type="button"
                      onClick={() => setForm(f => ({ ...f, priority: p }))}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.priority === p
                          ? "bg-white/[0.08] text-zinc-100 border border-white/[0.12]"
                          : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03]"
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        p === "CRITICAL" ? "bg-red-400" : p === "HIGH" ? "bg-orange-400" : p === "MEDIUM" ? "bg-amber-400" : "bg-emerald-400"
                      }`} />
                      <span className={form.priority === p ? PRIORITY_COLOR[p] : ""}>{p.charAt(0) + p.slice(1).toLowerCase()}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-caps block mb-1.5">Status</label>
                <div className="flex flex-col gap-1">
                  {STATUSES.map(s => (
                    <button key={s} type="button"
                      onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.status === s
                          ? "bg-white/[0.08] text-zinc-100 border border-white/[0.12]"
                          : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03]"
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        s === "DONE" ? "bg-emerald-400" : s === "IN_REVIEW" ? "bg-violet-400" : s === "IN_PROGRESS" ? "bg-blue-400" : "bg-zinc-500"
                      }`} />
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-caps block mb-1.5">Project</label>
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                  {projects.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => setForm(f => ({ ...f, projectId: p.id }))}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.projectId === p.id
                          ? "bg-white/[0.08] text-zinc-100 border border-white/[0.12]"
                          : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03]"
                      }`}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-caps block mb-1.5">Start Date</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full bg-[#111116] border border-white/[0.07] focus:border-cyan-500/30 rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none transition-colors" />
              </div>
              <div>
                <label className="label-caps block mb-1.5">Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full bg-[#111116] border border-white/[0.07] focus:border-cyan-500/30 rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none transition-colors" />
              </div>
            </div>

            {/* Subtasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label-caps">Subtasks</label>
                <button type="button" onClick={addSubtaskField}
                  className="text-[10px] text-cyan-500 hover:text-cyan-300 transition-colors">+ Add</button>
              </div>
              <div className="flex flex-col gap-1.5">
                {subtasks.map((s, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="w-3 h-3 rounded border border-white/20 flex-shrink-0" />
                    <input type="text" value={s} onChange={e => updateSubtask(i, e.target.value)}
                      placeholder={`Subtask ${i + 1}...`}
                      className="flex-1 bg-[#111116] border border-white/[0.07] focus:border-cyan-500/30 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 outline-none transition-colors" />
                    {subtasks.length > 1 && (
                      <button type="button" onClick={() => removeSubtask(i)}
                        className="text-zinc-700 hover:text-red-400 transition-colors text-sm">×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Contributors — from project's contributor list */}
            {users.length > 0 && (
              <div>
                <label className="label-caps block mb-2">Contributors</label>
                <div className="flex flex-wrap gap-2">
                  {users.map(u => {
                    const selected = contributors.includes(u.id);
                    return (
                      <button key={u.id} type="button" onClick={() => toggleContributor(u.id)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                          selected
                            ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
                            : "bg-white/[0.04] border border-white/[0.07] text-zinc-500 hover:text-zinc-300"
                        }`}>
                        <UserAvatar user={u} size={5} />
                        {u.name ?? u.email.split("@")[0]}
                        {selected && <span className="text-cyan-400">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.06] flex justify-end gap-2.5 px-5 sm:px-7 py-4">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 border border-white/[0.07] rounded-xl hover:border-white/[0.15] hover:bg-white/[0.04] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting || !form.title.trim()}
              className="px-5 py-2 text-sm font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 rounded-xl hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-colors disabled:opacity-40 disabled:hover:bg-cyan-500/10">
              {submitting ? "Creating…" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
