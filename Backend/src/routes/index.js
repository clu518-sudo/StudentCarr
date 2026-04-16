import { Router } from "express";
import authRoutes from "./auth.routes.js";
import profileManagementRoutes from "../profileManagement/index.js";
import processTrackingRoutes from "../processTracking/index.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/profile-management", profileManagementRoutes);
router.use("/process-tracking", processTrackingRoutes);

export default router;
