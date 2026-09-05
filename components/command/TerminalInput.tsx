"use client";

import { useMemo, useState } from "react";
import { parseSlashInput, SLASH_COMMANDS } from "@/lib/slashCommand";

interface TerminalInputProps {
  disabled: boolean;
  onSubmit: (text: string, command: string | null) => void;
}

export default function TerminalInput({ disabled, onSubmit }: TerminalInputProps) {
  const [value, setValue] = useState("");
  const parsed = useMemo(() => parseSlashInput(value), [value]);
  const suggestions = useMemo(() => {
    if (!value.startsWith("/") || value.includes(" ")) return [];
    const token = value.slice(1).toLowerCase();
    return SLASH_COMMANDS.filter((name) => name.startsWith(token)).slice(0, 6);
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    const next = parseSlashInput(text);
    if (next.isCommand) {
      console.info("[solomon/command]", next.command, next.argument);
    }
    onSubmit(text, next.command);
    setValue("");
  }

  return (
    <div className="flex-shrink-0 px-3 pb-3 pt-2">
      {suggestions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setValue(`/${name} `)}
              className="px-2 py-0.5 rounded-md text-[10px] font-mono text-cyan-400/80 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20"
            >
              /{name}
            </button>
          ))}
        </div>
      )}
      {parsed.isCommand && (
        <p className="text-[10px] font-mono text-cyan-500/70 mb-1.5">
          command {parsed.command} — stub logged, sent as chat
        </p>
      )}
      <div className="flex items-end gap-2 rounded-xl border border-cyan-500/40 bg-[#030712] focus-within:border-cyan-400 transition-colors px-3 py-2">
        <span className="text-cyan-500/70 font-mono text-xs pb-1">›</span>
        <textarea
          value={value}
          disabled={disabled}
          rows={1}
          placeholder="Counsel SOLOMON, or type / for commands…"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-700 outline-none min-h-[28px] max-h-32"
        />
        <button
          type="button"
          disabled={disabled || !value.trim()}
          onClick={submit}
          className="text-[11px] font-semibold text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 rounded-lg px-2.5 py-1 hover:bg-cyan-500/20 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
