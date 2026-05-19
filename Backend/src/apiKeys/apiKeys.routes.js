import { Router } from "express";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "./apiKeys.controller.js";
import { downloadBundle } from "./apiKeys.bundle.controller.js";

const router = Router();

// POST /api/keys
router.post("/", createApiKey);

// GET /api/keys
router.get("/", listApiKeys);

// DELETE /api/keys/:id
router.delete("/:id", revokeApiKey);

// POST /api/keys/bundle  — returns a pre-configured .mcpb zip
router.post("/bundle", downloadBundle);

export default router;
