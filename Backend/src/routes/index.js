import { Router } from "express";
import authRoutes from "./auth.routes.js";
import profileManagementRoutes from "../profileManagement/index.js";
import processTrackingRoutes from "../processTracking/index.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { streamUserEvents } from "../events/index.js";
import apiKeyRoutes from "../apiKeys/apiKeys.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.get("/events", requireAuth, streamUserEvents);
router.use("/profile-management", profileManagementRoutes);
router.use("/process-tracking", processTrackingRoutes);
router.use("/keys", requireAuth, apiKeyRoutes);

export default router;
