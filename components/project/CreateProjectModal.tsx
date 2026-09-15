"use client";

import { useEffect, useRef, useState } from "react";
import type { Project } from "@/types";

const PRESET_COLORS = ["#06b6d4","#8b5cf6","#4ade80","#f59e0b","#f87171","#38bdf8","#fb923c","#a78bfa"];

interface NeonUser { id: string; name: string | null; email: string | null; image: string | null }

function UserAvatar({ user }: { user: NeonUser }) {
  const label = user.name ?? user.email ?? "?";
  const initials = label.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return user.image
    ? <img src={user.image} alt={label} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
    : <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
        style={{ background: "linear-gradient(135deg,rgba(6,182,212,0.5),rgba(139,92,246,0.5))" }}>{initials}</div>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export default function CreateProjectModal({ isOpen, onClose, onCreated }: Props) {
  const [name, setName]             = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor]           = useState("#8b5cf6");
  const [contributorIds, setContributorIds] = useState<string[]>([]);
  const [users, setUsers]           = useState<NeonUser[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");
  const overlayRef                  = useRef<HTMLDivElement>(null);
  const nameRef                     = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nameRef.current?.focus(), 50);
      fetch("/api/users").then(r => r.ok ? r.json() : { users: [] }).then(d => setUsers(d.users ?? [])).catch(() => {});
    } else {
      setName(""); setDescription(""); setColor("#8b5cf6");
      setContributorIds([]); setEmailInput(""); setEmailError(""); setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) { setError("Name required"); return; }
    setSubmitting(true); setError("");

    const res = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description || null, color }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed to create"); setSubmitting(false); return; }

    const project: Project = data.project;

    // Add all selected contributors in parallel
    if (contributorIds.length > 0) {
      await Promise.all(
        contributorIds.map(uid => {
          const user = users.find(u => u.id === uid);
          if (!user?.email) return Promise.resolve();
          return fetch(`/api/projects/${project.id}/members`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email }),
          });
        })
      );
    }

    onCreated(project);
    setSubmitting(false);
    onClose();
  }

  function addByEmail() {
    setEmailError("");
    const found = users.find(u => u.email?.toLowerCase() === emailInput.toLowerCase());
    if (found) {
      setContributorIds(prev => prev.includes(found.id) ? prev : [...prev, found.id]);
      setEmailInput(""); return;
    }
    setEmailError("User not found — they need to sign in first");
  }

  const toggle = (id: string) =>
    setContributorIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4">

      <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-label="New project"
        className="w-full max-w-lg bg-black/70 backdrop-blur-xl border border-white/[0.1] rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] flex-shrink-0 px-5 sm:px-7 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">New Project</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-100 hover:bg-white/[0.07] transition-colors text-lg leading-none">×</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-5 px-5 sm:px-7 py-6">

          {/* Name */}
          <div>
            <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Project name..." required
              className="w-full bg-transparent text-lg font-semibold text-zinc-100 placeholder-zinc-700 outline-none border-b border-white/[0.07] pb-2 focus:border-cyan-500/40 transition-colors" />
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="label-caps block mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What is this project about?" rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.07] focus:border-cyan-500/30 rounded-xl px-3.5 py-3 text-sm text-zinc-300 placeholder-zinc-700 outline-none resize-none transition-colors" />
          </div>

          {/* Color */}
          <div>
            <label className="label-caps block mb-2">Color</label>
            <div className="flex gap-2.5 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all flex-shrink-0 ${
                    color === c ? "ring-2 ring-offset-2 ring-white/50 scale-110" : "hover:scale-105 opacity-70 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c }} />
              ))}
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-600 border border-white/[0.1]" style={{ backgroundColor: color }}>
                <span className="text-[8px] font-bold text-white/80">✓</span>
              </div>
            </div>
          </div>

          {/* Contributors */}
          <div>
            <label className="label-caps block mb-2">Contributors</label>
            {users.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-3">
                {users.map(u => {
                  const selected = contributorIds.includes(u.id);
                  return (
                    <button key={u.id} type="button" onClick={() => toggle(u.id)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                        selected ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
                                 : "bg-white/[0.04] border border-white/[0.07] text-zinc-500 hover:text-zinc-300"
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
            ) : (
              <p className="text-xs text-zinc-700 mb-3">No other users registered yet</p>
            )}

            {/* Email fallback */}
            <div className="flex gap-2">
              <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addByEmail(); } }}
                placeholder="Add by email (must have signed in)"
                className="flex-1 bg-white/[0.04] border border-white/[0.07] focus:border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-zinc-300 placeholder-zinc-700 outline-none transition-colors" />
              <button type="button" disabled={!emailInput.includes("@")} onClick={addByEmail}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-white/[0.08] text-zinc-500 hover:text-zinc-200 hover:border-white/[0.15] transition-all disabled:opacity-30">
                Add
              </button>
            </div>
            {emailError && <p className="text-[10px] text-red-400 mt-1">{emailError}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.07] flex justify-end flex-shrink-0"
          style={{ gap: '0.75rem', padding: '1rem 1.75rem' }}>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-200 border border-white/[0.07] rounded-xl hover:border-white/[0.15] transition-all">
            Cancel
          </button>
          <button type="submit" disabled={submitting || !name.trim()}
            className="px-5 py-2 text-sm font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-xl hover:bg-cyan-500/20 transition-all disabled:opacity-40">
            {submitting ? "Creating..." : "Create Project"}
          </button>
        </div>
      </form>
    </div>
  );
}
