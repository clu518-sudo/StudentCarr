import { Router } from "express";
import { requireMcpTokenAuth } from "../middleware/mcpTokenAuth.middleware.js";
import { mcpDispatcher } from "./mcp.controller.js";

const mcpRoutes = Router();

// all MCP endpoints use the short-lived scoped MCP token, not the sc_ API key
mcpRoutes.use(requireMcpTokenAuth);

// POST /api/mcp
mcpRoutes.post("/", mcpDispatcher);

export default mcpRoutes;
