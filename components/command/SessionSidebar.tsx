"use client";

import type { ChatSession } from "@/types";

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string, title: string) => void;
  onRename: (id: string, title: string) => void;
}

export default function SessionSidebar({
  sessions,
  activeSessionId,
  loading,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: SessionSidebarProps) {
  return (
    <div className="w-[220px] flex-shrink-0 flex flex-col border-r border-white/[0.06] min-h-0">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-[9px] font-semibold tracking-[0.15em] text-zinc-600 uppercase">
          Sessions
        </span>
        <button
          type="button"
          onClick={onCreate}
          className="w-5 h-5 flex items-center justify-center rounded-md text-zinc-600 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all text-base leading-none"
          title="New session"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-1">
        {loading && (
          <p className="text-[11px] text-zinc-700 px-2 py-3">Loading feeds…</p>
        )}
        {!loading && sessions.length === 0 && (
          <p className="text-[11px] text-zinc-700 px-2 py-3 text-center">
            No sessions yet.
          </p>
        )}
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            active={session.id === activeSessionId}
            onSelect={() => onSelect(session.id)}
            onDelete={() => onDelete(session.id, session.title)}
            onRename={(title) => onRename(session.id, title)}
          />
        ))}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  active,
  onSelect,
  onDelete,
  onRename,
}: {
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  function handleDoubleClick() {
    const next = window.prompt("Rename session", session.title);
    if (next && next.trim() && next.trim() !== session.title) {
      onRename(next.trim());
    }
  }

  return (
    <div
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
      className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all ${
        active
          ? "bg-cyan-500/10 border border-cyan-500/20"
          : "border border-transparent hover:bg-white/[0.04] hover:shadow-[0_0_15px_rgba(6,182,212,0.12)]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`text-xs truncate ${active ? "text-zinc-100 font-medium" : "text-zinc-500 group-hover:text-zinc-300"}`}>
          {session.title}
        </p>
        <p className="text-[9px] text-zinc-700 mt-0.5">
          {session.messageCount ?? 0} msg
        </p>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-400 transition-all text-sm leading-none w-4"
        title="Delete session"
      >
        ×
      </button>
    </div>
  );
}
