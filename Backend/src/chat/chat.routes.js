import { Router } from "express";
import {
  sendChatMessage,
  getChatHistory,
  clearChatHistory,
} from "./chat.controller.js";

const router = Router();

router.post("/", sendChatMessage);
router.get("/history", getChatHistory);
router.delete("/history", clearChatHistory); // TEMPORARY (Phase 7 testing aid)

export default router;