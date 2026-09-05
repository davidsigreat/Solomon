import type { UIMessage } from "ai";
import type { ChatMessage } from "@/types";

export function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const fromParts = message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
    if (fromParts) return fromParts;
  }
  return "";
}

export function dbMessagesToUI(messages: ChatMessage[]): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.sender === "USER" ? "user" : "assistant",
    parts: [{ type: "text" as const, text: message.content }],
  }));
}
