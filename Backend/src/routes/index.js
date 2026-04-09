import { Router } from "express";
import authRoutes from "./auth.routes.js";
import profileManagementRoutes from "../profileManagement/index.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/profile-management", profileManagementRoutes);

export default router;
