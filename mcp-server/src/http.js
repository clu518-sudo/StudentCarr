import http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer } from "./server.js";

const writeJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const methodNotAllowed = (res) => {
  res.writeHead(405, { "Content-Type": "application/json" }).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    }),
  );
};

const handleMcpRequest = async (req, res) => {
  const server = buildServer();
  try {
    // sessionIdGenerator: undefined => stateless mode. No session ID is ever
    // issued or checked, so any replica can handle any request.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (err) {
    console.error("[studentcarr-mcp] Error handling MCP request:", err);
    if (!res.headersSent) {
      writeJson(res, 500, {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
};

export const startHttpServer = (port, host) => {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      writeJson(res, 200, { success: true, status: "ok" });
      return;
    }

    if (req.url === "/mcp") {
      if (req.method === "POST") {
        await handleMcpRequest(req, res);
        return;
      }
      // No sessions exist in stateless mode, so there is nothing for GET
      // (standalone SSE stream) or DELETE (session termination) to do.
      methodNotAllowed(res);
      return;
    }

    writeJson(res, 404, { success: false, error: "Not found" });
  });

  server.listen(port, host, () => {
    console.log(`[studentcarr-mcp] Listening on http://${host}:${port}`);
  });

  return server;
};
