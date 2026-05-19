import { Router } from "express";
import { requireApiKeyAuth } from "../middleware/apiKeyAuth.middleware.js";
import { mcpDispatcher } from "./mcp.controller.js";

const mcpRoutes = Router();

// all MCP endpoints use API key auth
mcpRoutes.use(requireApiKeyAuth);

// POST /api/mcp/process-tracking
mcpRoutes.post("/", mcpDispatcher);

export default mcpRoutes;
