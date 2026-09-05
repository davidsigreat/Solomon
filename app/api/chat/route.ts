import { NextResponse } from "next/server";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getAuthorizedUser } from "@/lib/getUser";
import { getOwnedSession, lastUserText, persistChatTurn } from "@/lib/chat";
import { parseSlashInput } from "@/lib/slashCommand";
import { SOLOMON_MODEL, SOLOMON_SYSTEM_PROMPT } from "@/lib/solomon";

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await getAuthorizedUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error, reason: auth.reason }, { status: auth.status });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  }

  const body = await req.json();
  const messages = (body?.messages ?? []) as UIMessage[];
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const commandHint = typeof body?.command === "string" ? body.command : null;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages are required" }, { status: 400 });
  }

  const session = await getOwnedSession(sessionId, auth.userId);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userContent = lastUserText(messages);
  const parsed = parseSlashInput(userContent);
  const command = commandHint ?? parsed.command;

  if (parsed.isCommand) {
    console.info("[solomon/command]", { sessionId, command: parsed.command, argument: parsed.argument });
  }

  const result = streamText({
    model: anthropic(SOLOMON_MODEL),
    system: SOLOMON_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    onFinish: async ({ text }) => {
      try {
        await persistChatTurn({
          sessionId,
          userId: auth.userId,
          userContent,
          assistantContent: text,
          command,
        });
      } catch (error) {
        console.error("[solomon/chat] persist failed", error);
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
