import { Router } from "express";
import { requireApiKeyAuth } from "../middleware/apiKeyAuth.middleware";
import { processTrackingMcp } from "./mcp.controller";

const router = Router();

// all MCP endpoints use API key auth
router.use(requireApiKeyAuth);

// POST /api/mcp/process-tracking
router.post("/process-tracking", processTrackingMcp);

export default router;