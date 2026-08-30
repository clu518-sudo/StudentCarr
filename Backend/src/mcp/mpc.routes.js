import { Router } from "express";
import { requireMcpTokenAuth } from "../middleware/mcpTokenAuth.middleware.js";
import {
  mcpApplicationEmails,
  mcpApplications,
  mcpEmailDetail,
  mcpProfile,
} from "./mcp.controller.js";

const mcpRoutes = Router();

// all MCP endpoints use the short-lived scoped MCP token, not the sc_ API key
mcpRoutes.use(requireMcpTokenAuth);

// One route per tool, so no message-tag dispatcher grows into a second
// hand-maintained router.
// POST /api/mcp/applications
mcpRoutes.post("/applications", mcpApplications);
// POST /api/mcp/emails
mcpRoutes.post("/emails", mcpApplicationEmails);
// POST /api/mcp/emails/detail
mcpRoutes.post("/emails/detail", mcpEmailDetail);
// POST /api/mcp/profile
mcpRoutes.post("/profile", mcpProfile);

export default mcpRoutes;
