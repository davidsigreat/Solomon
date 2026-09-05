import { solomonMcpHandler } from "@/lib/mcp/solomonMcp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Streamable HTTP MCP endpoint.
 * Every call requires `Authorization: Bearer sk_live_*` — no session cookie.
 */
export { solomonMcpHandler as GET, solomonMcpHandler as POST, solomonMcpHandler as DELETE };
