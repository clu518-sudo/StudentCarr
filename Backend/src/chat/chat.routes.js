import { Router } from "express";
import { sendChatMessage, getChatHistory } from "./chat.controller.js";

const router = Router();

router.post("/", sendChatMessage);
router.post("/history", getChatHistory);

export default router;