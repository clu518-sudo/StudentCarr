import { Router } from "express";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "./apiKeys.controller.js";

const router = Router();

// POST /api/keys
router.post("/", createApiKey);

// GET /api/keys
router.get("/", listApiKeys);

// DELETE /api/keys/:id
router.delete("/:id", revokeApiKey);

export default router;
