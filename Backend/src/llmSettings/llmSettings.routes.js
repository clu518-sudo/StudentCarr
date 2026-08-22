import { Router } from "express";
import {
  listLlmKeys,
  createLlmKey,
  selectLlmKey,
  deleteLlmKey,
} from "./llmSettings.controller.js";

const router = Router();

// GET /api/llm-settings — list saved settings (masked)
router.get("/", listLlmKeys);

// POST /api/llm-settings — save a new named LLM setting
router.post("/", createLlmKey);

// POST /api/llm-settings/:id/select — mark one setting as active
router.post("/:id/select", selectLlmKey);

// DELETE /api/llm-settings/:id — remove a saved setting
router.delete("/:id", deleteLlmKey);

export default router;
