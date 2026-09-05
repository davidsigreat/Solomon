export type ParsedSlash = {
  isCommand: boolean;
  command: string | null;
  argument: string;
  raw: string;
};

/** Known stubs — handlers land in a later wave. Parser only in Wave 1. */
export const SLASH_COMMANDS = [
  "brief",
  "note",
  "search",
  "task",
  "recall",
  "memory",
  "save",
  "goals",
] as const;

const COMMAND_RE = /^\/([a-zA-Z][\w-]*)(?:\s+([\s\S]*))?$/;

export function parseSlashInput(raw: string): ParsedSlash {
  const text = raw.trim();
  const match = text.match(COMMAND_RE);
  if (!match) {
    return { isCommand: false, command: null, argument: "", raw: text };
  }
  return {
    isCommand: true,
    command: `/${match[1].toLowerCase()}`,
    argument: (match[2] ?? "").trim(),
    raw: text,
  };
}
