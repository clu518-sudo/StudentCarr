import { startHttpServer } from "./http.js";

const PORT = Number(process.env.MCP_PORT || 10004);
const HOST = process.env.MCP_HOST || "127.0.0.1";

startHttpServer(PORT, HOST);
