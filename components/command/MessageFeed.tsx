"use client";

import { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import type { UIMessage } from "ai";

interface MessageFeedProps {
  messages: UIMessage[];
  streaming: boolean;
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export default function MessageFeed({ messages, streaming }: MessageFeedProps) {
  const items = useMemo(() => messages, [messages]);

  if (items.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6">
        <p className="text-[10px] font-mono tracking-[0.3em] text-zinc-700 uppercase mb-2">
          SOLOMON online
        </p>
        <p className="text-sm text-zinc-400">Your personal counsel.</p>
        <p className="text-xs text-zinc-600 mt-2">
          Ask a question, or start a slash command with <span className="text-cyan-500/80 font-mono">/</span>
        </p>
      </div>
    );
  }

  return (
    <Virtuoso
      className="flex-1 min-h-0"
      data={items}
      followOutput="smooth"
      increaseViewportBy={{ top: 200, bottom: 200 }}
      itemContent={(index, message) => {
        const text = messageText(message);
        const isUser = message.role === "user";
        const isCommand = isUser && text.trim().startsWith("/");
        const isLast = index === items.length - 1;
        return (
          <div className={`px-4 py-2.5 flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 border ${
                isUser
                  ? "bg-white/[0.04] border-white/[0.08] text-zinc-200"
                  : "bg-[#0b1329] border-cyan-500/20 text-zinc-100"
              }`}
            >
              <p className="text-[9px] font-mono tracking-widest text-zinc-600 mb-1">
                {isUser ? (isCommand ? "COMMAND" : "YOU") : "SOLOMON"}
              </p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {text || (streaming && isLast && !isUser ? "…" : "")}
              </p>
            </div>
          </div>
        );
      }}
    />
  );
}
