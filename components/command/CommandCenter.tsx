"use client";

import { useCallback, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import SessionSidebar from "@/components/command/SessionSidebar";
import MessageFeed from "@/components/command/MessageFeed";
import TerminalInput from "@/components/command/TerminalInput";
import { dbMessagesToUI } from "@/lib/chatMessages";
import type { ChatMessage, ChatSession } from "@/types";

export default function CommandCenter() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [mobileSessionsOpen, setMobileSessionsOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const response = await fetch("/api/sessions");
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setAuthError(typeof data.error === "string" ? data.error : "Could not load sessions.");
      setSessions([]);
      setSessionsLoading(false);
      return [];
    }
    const data = await response.json();
    const next = (data.sessions ?? []) as ChatSession[];
    setAuthError(null);
    setSessions(next);
    setSessionsLoading(false);
    return next;
  }, []);

  const loadSessionMessages = useCallback(async (sessionId: string) => {
    setMessagesLoading(true);
    const response = await fetch(`/api/sessions/${sessionId}`);
    if (!response.ok) {
      setInitialMessages([]);
      setMessagesLoading(false);
      return;
    }
    const data = await response.json();
    setInitialMessages(dbMessagesToUI((data.messages ?? []) as ChatMessage[]));
    setMessagesLoading(false);
  }, []);

  useEffect(() => {
    loadSessions().then((next) => {
      if (next[0]) setActiveSessionId(next[0].id);
    }).catch(() => setSessionsLoading(false));
  }, [loadSessions]);

  useEffect(() => {
    if (!activeSessionId) {
      setInitialMessages([]);
      return;
    }
    loadSessionMessages(activeSessionId).catch(() => setMessagesLoading(false));
  }, [activeSessionId, loadSessionMessages]);

  async function createSession() {
    const response = await fetch("/api/sessions", { method: "POST" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setAuthError(typeof data.error === "string" ? data.error : "Could not create a session.");
      return;
    }
    setAuthError(null);
    const data = await response.json();
    const session = data.session as ChatSession;
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    setInitialMessages([]);
    setMobileSessionsOpen(false);
  }

  async function deleteSession(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    const remaining = sessions.filter((session) => session.id !== id);
    setSessions(remaining);
    if (activeSessionId === id) {
      setActiveSessionId(remaining[0]?.id ?? null);
    }
  }

  async function renameSession(id: string, title: string) {
    const response = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) return;
    setSessions((current) =>
      current.map((session) => (session.id === id ? { ...session, title } : session)),
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col rounded-2xl border border-white/[0.06] bg-[#0b1329]/60 overflow-hidden">
      <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={() => setMobileSessionsOpen((open) => !open)}
          className="text-[11px] text-zinc-400 hover:text-zinc-200"
        >
          {mobileSessionsOpen ? "Hide sessions" : "Sessions"}
        </button>
        <button type="button" onClick={createSession} className="text-[11px] text-cyan-400">
          New
        </button>
      </div>
      <div className="flex-1 min-h-0 flex">
        <div className={`${mobileSessionsOpen ? "flex" : "hidden"} md:flex`}>
          <SessionSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            loading={sessionsLoading}
            onSelect={(id) => {
              setActiveSessionId(id);
              setMobileSessionsOpen(false);
            }}
            onCreate={createSession}
            onDelete={deleteSession}
            onRename={renameSession}
          />
        </div>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {activeSessionId && !messagesLoading ? (
            <ChatPane
              key={activeSessionId}
              sessionId={activeSessionId}
              initialMessages={initialMessages}
              onTurnComplete={loadSessions}
            />
          ) : (
            <EmptyPane
              loading={sessionsLoading || messagesLoading}
              error={authError}
              onCreate={createSession}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyPane({ loading, error, onCreate }: { loading: boolean; error: string | null; onCreate: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <p className="text-[10px] font-mono tracking-[0.3em] text-zinc-700 uppercase mb-2">
        SOLOMON online
      </p>
      <p className="text-sm text-zinc-400">Your personal counsel.</p>
      {error && <p className="mt-3 text-xs text-red-400 max-w-sm">{error}</p>}
      {!loading && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 text-xs text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 rounded-lg px-3 py-1.5 hover:bg-cyan-500/20"
        >
          Start a session
        </button>
      )}
    </div>
  );
}

function ChatPane({
  sessionId,
  initialMessages,
  onTurnComplete,
}: {
  sessionId: string;
  initialMessages: UIMessage[];
  onTurnComplete: () => void;
}) {
  const { messages, sendMessage, status, error } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { sessionId },
    }),
    onFinish: () => {
      onTurnComplete();
    },
  });

  const busy = status === "submitted" || status === "streaming";

  function handleSubmit(text: string, command: string | null) {
    sendMessage({ text }, { body: { sessionId, command } });
  }

  return (
    <>
      <MessageFeed messages={messages} streaming={busy} />
      {error && (
        <p className="px-4 text-[11px] text-red-400">
          {error.message || "SOLOMON could not reply. Try again."}
        </p>
      )}
      <TerminalInput disabled={busy} onSubmit={handleSubmit} />
    </>
  );
}
