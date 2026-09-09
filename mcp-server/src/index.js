import "./httpAgent.js";
import { startHttpServer } from "./http.js";

const PORT = Number(process.env.MCP_PORT || 10004);
const HOST = process.env.MCP_HOST || "127.0.0.1";

const server = startHttpServer(PORT, HOST);

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
