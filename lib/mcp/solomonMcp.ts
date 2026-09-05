import type { AuthInfo, ServerContext } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { authenticateApiKey, getApiAuth, type AuthedUser, type PublicResult } from "@/lib/apiAuth";
import {
  getPortfolioStatus,
  listAccessibleProjects,
  listPublicTasks,
  logPublicSprint,
  upsertPublicTask,
} from "@/lib/solomonPublic";

const TASK_STATUS = z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);
const TASK_PRIORITY = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
const SPRINT_MODE = z.enum(["FOCUS", "SHORT_BREAK", "LONG_BREAK"]);

function jsonContent(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorContent(error: string, status?: number) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error, ...(status ? { status } : {}) }) }],
    isError: true,
  };
}

async function userFromCtx(ctx: ServerContext): Promise<AuthedUser | null> {
  if (ctx.http?.req) {
    const auth = await getApiAuth(ctx.http.req);
    if (auth.ok) return auth;
  }
  const extra = ctx.http?.authInfo?.extra as { user?: AuthedUser } | undefined;
  return extra?.user ?? null;
}

function fromPublic<T>(result: PublicResult<T>) {
  if (!result.ok) return errorContent(result.error, result.status);
  return jsonContent(result.data);
}

async function verifySolomonToken(
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  try {
    if (!bearerToken) return undefined;
    const auth = await authenticateApiKey(bearerToken);
    if (!auth.ok) {
      // Unknown/revoked key → 401. Whitelist miss → empty scopes → 403.
      if (auth.status === 403) {
        return { token: bearerToken, clientId: "forbidden", scopes: [] };
      }
      return undefined;
    }
    return {
      token: bearerToken,
      clientId: auth.userId,
      scopes: auth.canEdit ? ["read", "write"] : ["read"],
      extra: { user: auth },
    };
  } catch {
    return undefined;
  }
}

const inner = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_projects",
      {
        title: "List projects",
        description: "List Solomon projects the API key can access (id, name, color, description).",
        inputSchema: z.object({}),
      },
      async (_args, ctx) => {
        const user = await userFromCtx(ctx);
        if (!user) return errorContent("Unauthorized", 401);
        return jsonContent(await listAccessibleProjects(user));
      },
    );

    server.registerTool(
      "portfolio_status",
      {
        title: "Portfolio status",
        description:
          "Cross-project status hub: task counts by status, overdue count, and a short open-task sample for each accessible project. Pass projectId to limit to one project.",
        inputSchema: z.object({
          projectId: z.string().optional().describe("Optional project id to inspect a single project"),
        }),
      },
      async ({ projectId }, ctx) => {
        const user = await userFromCtx(ctx);
        if (!user) return errorContent("Unauthorized", 401);
        return jsonContent(await getPortfolioStatus(user, projectId));
      },
    );

    server.registerTool(
      "list_tasks",
      {
        title: "List tasks",
        description: "List tasks across accessible Solomon projects. Filter by projectId and/or status.",
        inputSchema: z.object({
          projectId: z.string().optional(),
          status: TASK_STATUS.optional(),
        }),
      },
      async ({ projectId, status }, ctx) => {
        const user = await userFromCtx(ctx);
        if (!user) return errorContent("Unauthorized", 401);
        return fromPublic(await listPublicTasks(user, { projectId, status }));
      },
    );

    server.registerTool(
      "upsert_task",
      {
        title: "Create or update a task",
        description:
          "Create a task (title + projectId) or update an existing task by id, including status. App VIEWER and project VIEWER cannot mutate.",
        inputSchema: z.object({
          id: z.string().optional().describe("Existing task id to update"),
          title: z.string().optional(),
          description: z.string().optional(),
          projectId: z.string().optional(),
          priority: TASK_PRIORITY.optional(),
          status: TASK_STATUS.optional(),
          startDate: z.string().nullable().optional(),
          dueDate: z.string().nullable().optional(),
        }),
      },
      async (input, ctx) => {
        const user = await userFromCtx(ctx);
        if (!user) return errorContent("Unauthorized", 401);
        return fromPublic(await upsertPublicTask(user, input));
      },
    );

    server.registerTool(
      "log_sprint",
      {
        title: "Log a sprint",
        description: "Log a completed focus/break sprint session. VIEWER cannot mutate.",
        inputSchema: z.object({
          duration: z.number().int().positive().describe("Duration in minutes"),
          taskName: z.string().optional(),
          projectId: z.string().optional(),
          mode: SPRINT_MODE.optional(),
          completed: z.boolean().optional(),
        }),
      },
      async (input, ctx) => {
        const user = await userFromCtx(ctx);
        if (!user) return errorContent("Unauthorized", 401);
        return fromPublic(await logPublicSprint(user, input));
      },
    );
  },
  {
    serverInfo: { name: "solomon", version: "2.0.0" },
    instructions:
      "Solomon is a cross-project status hub. Authenticate with Authorization: Bearer sk_live_* minted in Profile. VIEWER is read-only. MEMBER/ADMIN may mutate where the project role allows.",
  },
);

export const solomonMcpHandler = withMcpAuth(inner, verifySolomonToken, {
  required: true,
  requiredScopes: ["read"],
});
