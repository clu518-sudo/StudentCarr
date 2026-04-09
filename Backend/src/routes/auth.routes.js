import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  loginRateLimit,
  signupRateLimit,
} from "../middleware/rateLimit.middleware.js";

const router = Router();

router.post("/signup", signupRateLimit, authController.signup);
router.post("/login", loginRateLimit, authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);

export default router;
