import { Router } from "express";
import authRoutes from "./auth.routes.js";
import profileManagementRoutes from "../profileManagement/index.js";
import processTrackingRoutes from "../processTracking/index.js";
import { requireAuth, requireAdmin } from "../middleware/auth.middleware.js";
import { chatRateLimit } from "../middleware/rateLimit.middleware.js";
import { streamUserEvents } from "../events/index.js";
import apiKeyRoutes from "../apiKeys/apiKeys.routes.js";
import mcpRoutes from "../mcp/index.js";
import chatRoutes from "../chat/index.js"
import llmSettingsRoutes from "../llmSettings/index.js";

const router = Router();

router.use("/auth", authRoutes);
router.get("/events", requireAuth, streamUserEvents);
router.use("/profile-management", profileManagementRoutes);
router.use("/process-tracking", processTrackingRoutes);
router.use("/keys", requireAuth, apiKeyRoutes);
router.use("/mcp", mcpRoutes);
// Only admins may configure the LLM key the demo runs on.
router.use("/llm-settings", requireAuth, requireAdmin, llmSettingsRoutes);
// Rate-limited before AIServices is ever called — LLM calls cost money,
// so abusive traffic is rejected before that cost is incurred.
router.use("/chat", requireAuth, chatRateLimit, chatRoutes);

export default router;
