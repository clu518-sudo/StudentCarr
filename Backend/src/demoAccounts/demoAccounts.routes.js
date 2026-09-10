import { Router } from "express";
import { optionalAuth } from "../middleware/auth.middleware.js";
import { demoAccountRateLimit } from "../middleware/rateLimit.middleware.js";
import { createDemoAccountHandler } from "./demoAccounts.controller.js";

const router = Router();

// Public — reachable from the anonymous login page's "Create demo account"
// button. optionalAuth populates req.user when a valid admin token is
// present (demoAccountRateLimit then exempts them); it never blocks an
// anonymous request.
router.post("/", optionalAuth, demoAccountRateLimit, createDemoAccountHandler);

export default router;
