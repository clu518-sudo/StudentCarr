import { Router } from "express";
import {
  sendChatMessage,
  getChatHistory,
  clearChatHistory,
  streamChatMessage,
} from "./chat.controller.js";

const router = Router();

router.post("/", sendChatMessage);
router.post("/stream", streamChatMessage);
router.get("/history", getChatHistory);
router.delete("/history", clearChatHistory); // TEMPORARY (Phase 7 testing aid)

export default router;