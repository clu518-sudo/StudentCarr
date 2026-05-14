import { Router } from "express";
import { requireApiKeyAuth } from "../middleware/apiKeyAuth.middleware.js";
import { processTrackingMcp } from "./mcp.controller.js";

const mcpRoutes = Router();

// all MCP endpoints use API key auth
mcpRoutes.use(requireApiKeyAuth);

// POST /api/mcp/process-tracking
mcpRoutes.post("/process-tracking", processTrackingMcp);

export default mcpRoutes;
