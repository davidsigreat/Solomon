import "server-only";
import { db } from "@/lib/db";
import { DEFAULT_SESSION_TITLE } from "@/lib/solomon";
import type { ChatMessage, ChatSender } from "@/types";
export { lastUserText, dbMessagesToUI } from "@/lib/chatMessages";

export async function getOwnedSession(sessionId: string, userId: string) {
  return db.session.findFirst({ where: { id: sessionId, userId } });
}

export function serializeMessage(message: {
  id: string;
  sessionId: string;
  sender: string;
  content: string;
  command: string | null;
  createdAt: Date;
}): ChatMessage {
  return {
    id: message.id,
    sessionId: message.sessionId,
    sender: message.sender as ChatSender,
    content: message.content,
    command: message.command,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function persistChatTurn(opts: {
  sessionId: string;
  userId: string;
  userContent: string;
  assistantContent: string;
  command: string | null;
}) {
  const session = await db.session.findFirst({
    where: { id: opts.sessionId, userId: opts.userId },
    include: { _count: { select: { messages: true } } },
  });
  if (!session) return;

  await db.message.createMany({
    data: [
      {
        sessionId: opts.sessionId,
        sender: "USER",
        content: opts.userContent,
        command: opts.command,
      },
      {
        sessionId: opts.sessionId,
        sender: "SOLOMON",
        content: opts.assistantContent,
      },
    ],
  });

  const shouldTitle =
    session.title === DEFAULT_SESSION_TITLE && session._count.messages === 0;
  const nextTitle = shouldTitle
    ? opts.userContent.replace(/\s+/g, " ").slice(0, 60) || DEFAULT_SESSION_TITLE
    : undefined;

  await db.session.update({
    where: { id: opts.sessionId },
    data: nextTitle ? { title: nextTitle } : { updatedAt: new Date() },
  });
}
