import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { toolDefinitions, getHandler } from "./tools/index.js";

// Returns an UNCONNECTED server. Transport is chosen by the caller (see http.js),
// so this factory can be called once per request in stateless mode.
// requestId is this HTTP request's own id (see http.js) — it traces this one
// tool call through to the Backend REST call it makes, but not back to the
// originating chat turn: AIServices caches its MCP client per user, so the
// request that established the connection isn't necessarily the request
// making this particular call.
export const buildServer = (requestId) => {
  const server = new Server(
    { name: "studentcarr", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const handler = getHandler(request.params.name);
    if (!handler) {
      return {
        isError: true,
        content: [
          { type: "text", text: `Unknown tool: ${request.params.name}` },
        ],
      };
    }
    // Forwarded, not verified here — mcp-server has zero business logic.
    // Backend's requireMcpTokenAuth is the actual verification boundary.
    const authHeader = extra?.requestInfo?.headers?.authorization;
    console.log(`[mcp:${requestId}] callTool ${request.params.name}`);
    return handler(request.params.arguments, { authHeader, requestId });
  });

  return server;
};
