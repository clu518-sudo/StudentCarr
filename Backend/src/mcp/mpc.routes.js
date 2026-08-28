import { Router } from "express";
import { requireMcpTokenAuth } from "../middleware/mcpTokenAuth.middleware.js";
import { mcpDispatcher, mcpProfile } from "./mcp.controller.js";

const mcpRoutes = Router();

// all MCP endpoints use the short-lived scoped MCP token, not the sc_ API key
mcpRoutes.use(requireMcpTokenAuth);

// POST /api/mcp
mcpRoutes.post("/", mcpDispatcher);

// One route per tool from here on, so the message-tag dispatcher above does not
// grow into a second hand-maintained router.
// POST /api/mcp/profile
mcpRoutes.post("/profile", mcpProfile);

export default mcpRoutes;
